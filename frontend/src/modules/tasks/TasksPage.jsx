import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addChecklistItem,
  addTaskAssignees,
  createTask,
  deleteChecklistItem,
  deleteTask,
  getTaskById,
  getTaskSummary,
  getTasks,
  removeTaskAssignee,
  updateChecklistItem,
  updateTask,
} from "../../api/taskApi";
import { getOrganizationMembers } from "../../api/organizationApi";
import { useAuth } from "../../context/AuthContext";
import { useWorkHubToast } from "../../components/feedback/workHubToast";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import {
  EMPTY_TASK_FORM,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_MAP,
} from "./taskConstants";
import {
  formatTaskDate,
  fromDateInputValue,
  getDueState,
  getInitials,
  getTaskId,
  getTaskPriorityMeta,
  getTaskStatusMeta,
  getUserId,
  isUserTask,
  parseChecklistText,
  taskMatchesSearch,
  toDateInputValue,
} from "./taskUtils";

const Icon = ({ className = "", name }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const cx = (...classes) => classes.filter(Boolean).join(" ");

const OPEN_STATUS_IDS = ["todo", "in_progress", "review", "blocked"];
const STATUS_FLOW = TASK_STATUSES.map((status) => status.id);
const PRIORITY_WEIGHT = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const VIEW_MODES = [
  { id: "board", label: "Bảng", icon: "view_kanban" },
  { id: "list", label: "Danh sách", icon: "table_rows" },
  { id: "focus", label: "Tập trung", icon: "filter_center_focus" },
];

const QUICK_FILTERS = [
  { id: "all", label: "Tất cả", icon: "select_all" },
  { id: "mine", label: "Liên quan tới tôi", icon: "account_circle" },
  { id: "overdue", label: "Quá hạn", icon: "event_busy" },
  { id: "due_soon", label: "Sắp đến hạn", icon: "event_upcoming" },
  { id: "blocked", label: "Đang vướng", icon: "report" },
  { id: "unassigned", label: "Chưa giao", icon: "person_off" },
];

const SORT_OPTIONS = [
  { id: "updated", label: "Mới cập nhật" },
  { id: "due", label: "Hạn gần nhất" },
  { id: "priority", label: "Ưu tiên cao" },
  { id: "status", label: "Theo luồng việc" },
];

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const getMemberUser = (member) => member?.user || member;

const getMemberUserId = (member) =>
  getMemberUser(member)?.id ||
  getMemberUser(member)?._id ||
  member?.userId ||
  member?.id ||
  "";

const getMemberName = (member) =>
  getMemberUser(member)?.fullName ||
  getMemberUser(member)?.name ||
  getMemberUser(member)?.email ||
  "Thành viên";

const getTaskShortId = (task) => {
  const taskId = String(getTaskId(task) || "");
  return taskId ? taskId.slice(-6).toUpperCase() : "TASK";
};

const getDateTime = (value, fallback = 0) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : fallback;
};

const getDaysUntilDue = (task) => {
  if (!task?.endAt) return null;
  const dueDate = new Date(task.endAt);
  if (!Number.isFinite(dueDate.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.round((dueDate - today) / (24 * 60 * 60 * 1000));
};

const formatDueDistance = (task) => {
  const days = getDaysUntilDue(task);
  if (days === null || ["done", "cancelled"].includes(task?.status)) {
    return formatTaskDate(task?.endAt);
  }
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Đến hạn hôm nay";
  if (days === 1) return "Đến hạn ngày mai";
  if (days <= 7) return `Còn ${days} ngày`;
  return formatTaskDate(task.endAt);
};

const getChecklistProgress = (task) => ({
  done: task?.checklistProgress?.done || 0,
  total: task?.checklistProgress?.total || 0,
  percent: task?.checklistProgress?.percent || 0,
});

const taskMatchesQuickFilter = (task, quickFilter, currentUserId) => {
  if (quickFilter === "all") return true;
  if (quickFilter === "mine") return isUserTask(task, currentUserId);
  if (quickFilter === "overdue") return getDueState(task) === "overdue";
  if (quickFilter === "due_soon") return getDueState(task) === "soon";
  if (quickFilter === "blocked") return task.status === "blocked";
  if (quickFilter === "unassigned") return !(task.assignees || []).length;
  return true;
};

const sortTasks = (items, sortBy) => {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sortBy === "due") {
      const dueA = getDateTime(a.endAt, Number.MAX_SAFE_INTEGER);
      const dueB = getDateTime(b.endAt, Number.MAX_SAFE_INTEGER);
      if (dueA !== dueB) return dueA - dueB;
    }

    if (sortBy === "priority") {
      const priorityA = PRIORITY_WEIGHT[a.priority] ?? 9;
      const priorityB = PRIORITY_WEIGHT[b.priority] ?? 9;
      if (priorityA !== priorityB) return priorityA - priorityB;
    }

    if (sortBy === "status") {
      const statusA = STATUS_FLOW.indexOf(a.status);
      const statusB = STATUS_FLOW.indexOf(b.status);
      if (statusA !== statusB) return statusA - statusB;
    }

    return (
      getDateTime(b.updatedAt || b.createdAt, 0) -
      getDateTime(a.updatedAt || a.createdAt, 0)
    );
  });
  return sorted;
};

const getAdjacentStatuses = (statusId) => {
  const currentIndex = STATUS_FLOW.indexOf(statusId);
  return {
    previous: currentIndex > 0 ? TASK_STATUS_MAP[STATUS_FLOW[currentIndex - 1]] : null,
    next:
      currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1
        ? TASK_STATUS_MAP[STATUS_FLOW[currentIndex + 1]]
        : null,
  };
};

const buildTaskInsights = (items) => {
  const total = items.length;
  const done = items.filter((task) => task.status === "done").length;
  const open = items.filter((task) => OPEN_STATUS_IDS.includes(task.status)).length;
  const blocked = items.filter((task) => task.status === "blocked").length;
  const overdue = items.filter((task) => getDueState(task) === "overdue").length;
  const dueSoon = items.filter((task) => getDueState(task) === "soon").length;
  const urgent = items.filter((task) => task.priority === "urgent").length;
  const unassigned = items.filter((task) => !(task.assignees || []).length).length;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const checklistTotal = items.reduce(
    (sum, task) => sum + (task.checklistProgress?.total || 0),
    0,
  );
  const checklistDone = items.reduce(
    (sum, task) => sum + (task.checklistProgress?.done || 0),
    0,
  );
  const checklistRate = checklistTotal
    ? Math.round((checklistDone / checklistTotal) * 100)
    : 0;

  return {
    blocked,
    checklistDone,
    checklistRate,
    checklistTotal,
    completionRate,
    done,
    dueSoon,
    open,
    overdue,
    total,
    unassigned,
    urgent,
  };
};

const getTaskAssigneeLabel = (task) => {
  const assignees = task.assignees || [];
  if (!assignees.length) return "Chưa giao";
  return assignees
    .slice(0, 2)
    .map((assignment) => assignment.user?.fullName || assignment.user?.email || "Thành viên")
    .join(", ");
};

const Avatar = ({ className = "", user }) => {
  const avatarUrl = getAvatarUrl(user?.avatar);
  const name = user?.fullName || user?.email || "WorkHub";

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
      className={cx("task-avatar object-cover", className)}
    />
  ) : (
    <span className={cx("task-avatar task-avatar-fallback", className)}>
      {getInitials(name)}
    </span>
  );
};

const AvatarStack = ({ assignees = [], max = 4 }) => {
  const visibleAssignees = assignees.slice(0, max);
  const hiddenCount = Math.max(0, assignees.length - visibleAssignees.length);

  if (!assignees.length) {
    return (
      <span className="task-avatar-empty" title="Chưa giao người phụ trách">
        <Icon name="person_add" />
      </span>
    );
  }

  return (
    <div className="task-avatar-stack" title={getTaskAssigneeLabel({ assignees })}>
      {visibleAssignees.map((assignment, index) => (
        <Avatar
          key={assignment.userId || assignment.id || index}
          user={assignment.user}
          className="-ml-2 first:ml-0"
        />
      ))}
      {hiddenCount > 0 && (
        <span className="task-avatar task-avatar-more -ml-2">+{hiddenCount}</span>
      )}
    </div>
  );
};

const TaskPriorityBadge = ({ priority }) => {
  const meta = getTaskPriorityMeta(priority);

  return (
    <span
      className="task-priority-badge"
      style={{
        "--task-priority-bg": meta.soft,
        "--task-priority-color": meta.accent,
      }}
    >
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
};

const TaskDueBadge = ({ task }) => {
  const dueState = getDueState(task);

  return (
    <span className={`task-due-badge task-due-badge--${dueState}`}>
      <Icon name={dueState === "overdue" ? "event_busy" : "event"} />
      {formatDueDistance(task)}
    </span>
  );
};

const TaskStatusPill = ({ status }) => {
  const meta = getTaskStatusMeta(status);

  return (
    <span
      className="task-status-pill"
      style={{
        "--task-status-color": meta.accent,
        "--task-status-bg": meta.soft,
      }}
    >
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
};

const TaskQuickStatusActions = ({ onChange, task }) => {
  const canChangeStatus = Boolean(task.permissions?.canChangeStatus);
  const { previous, next } = getAdjacentStatuses(task.status);

  if (!canChangeStatus || (!previous && !next)) {
    return null;
  }

  return (
    <div className="task-card-actions" aria-label="Chuyển trạng thái nhanh">
      {previous && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange(task, previous.id);
          }}
          className="task-card-action task-card-action--muted"
        >
          <Icon name="arrow_back" />
          {previous.shortLabel}
        </button>
      )}
      {next && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange(task, next.id);
          }}
          className="task-card-action"
        >
          {next.shortLabel}
          <Icon name="arrow_forward" />
        </button>
      )}
    </div>
  );
};

const TaskCard = ({
  isDragging,
  onClick,
  onDragEnd,
  onDragStart,
  onQuickStatusChange,
  task,
}) => {
  const status = getTaskStatusMeta(task.status);
  const canDrag = Boolean(task.permissions?.canChangeStatus);
  const checklistProgress = getChecklistProgress(task);

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cx(
        "task-card",
        canDrag && "task-card--draggable",
        isDragging && "task-card--dragging",
      )}
      style={{
        "--task-card-accent": status.accent,
        "--task-card-soft": status.soft,
      }}
    >
      <div className="task-card-topline">
        <span className="task-card-id">#{getTaskShortId(task)}</span>
        <TaskStatusPill status={task.status} />
      </div>

      <div className="task-card-heading">
        <div className="min-w-0">
          <h3 className="task-card-title">{task.title}</h3>
          {task.description && (
            <p className="task-card-description">{task.description}</p>
          )}
        </div>
        <span className="task-card-status-icon">
          <Icon name={status.icon} />
        </span>
      </div>

      <div className="task-card-badges">
        <TaskPriorityBadge priority={task.priority} />
        <TaskDueBadge task={task} />
      </div>

      <div className="task-card-progress">
        <div className="task-card-progress-label">
          <span>Checklist</span>
          <strong>
            {checklistProgress.done}/{checklistProgress.total}
          </strong>
        </div>
        <div className="task-progress-track">
          <span
            className="task-progress-bar"
            style={{ width: `${checklistProgress.percent}%` }}
          />
        </div>
      </div>

      <div className="task-card-footer">
        <AvatarStack assignees={task.assignees || []} />
        <span className="task-card-updated">
          <Icon name="schedule" />
          {formatTaskDate(task.updatedAt || task.createdAt)}
        </span>
      </div>

      <TaskQuickStatusActions onChange={onQuickStatusChange} task={task} />
    </article>
  );
};

const TaskColumn = ({
  draggingTaskId,
  isDropTarget,
  onCardClick,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragStart,
  onDrop,
  onQuickStatusChange,
  status,
  tasks,
}) => (
  <section
    className={cx("task-column", isDropTarget && "is-drop-target")}
    onDragOver={(event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }}
    onDragEnter={() => onDragEnter(status.id)}
    onDragLeave={() => onDragLeave(status.id)}
    onDrop={(event) => onDrop(event, status.id)}
    style={{
      "--task-column-accent": status.accent,
      "--task-column-soft": status.soft,
      "--task-column-border": status.border,
    }}
  >
    <header className="task-column-header">
      <span className="task-column-icon">
        <Icon name={status.icon} />
      </span>
      <div className="min-w-0">
        <h2>{status.label}</h2>
        <p>{tasks.length} công việc</p>
      </div>
    </header>

    <div className="task-column-body">
      {tasks.length ? (
        tasks.map((task) => (
          <TaskCard
            key={getTaskId(task)}
            isDragging={draggingTaskId === getTaskId(task)}
            onClick={() => onCardClick(task)}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onQuickStatusChange={onQuickStatusChange}
            task={task}
          />
        ))
      ) : (
        <div className="task-column-empty">
          <Icon name="inbox" />
          <span>Không có việc trong cột này</span>
          <small>Kéo task vào đây hoặc tạo task mới.</small>
        </div>
      )}
    </div>
  </section>
);

const TaskSummaryCard = ({ caption, icon, label, tone, value }) => (
  <article className={`task-summary-card task-summary-card--${tone}`}>
    <span className="task-summary-icon">
      <Icon name={icon} />
    </span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </div>
  </article>
);

const TaskMemberPicker = ({
  disabled = false,
  members = [],
  onChange,
  selectedIds = [],
}) => {
  if (!members.length) return null;

  const selectedIdSet = new Set(selectedIds.map(String));

  return (
    <div className="task-member-picker">
      {members.map((member) => {
        const memberUser = getMemberUser(member);
        const memberId = getMemberUserId(member);
        const selected = selectedIdSet.has(String(memberId));
        return (
          <button
            key={memberId}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(
                selected
                  ? selectedIds.filter((item) => String(item) !== String(memberId))
                  : [...selectedIds, memberId],
              );
            }}
            className={cx("task-member-option", selected && "is-selected")}
          >
            <Avatar user={memberUser} />
            <span>{getMemberName(member)}</span>
            <Icon name={selected ? "check_circle" : "radio_button_unchecked"} />
          </button>
        );
      })}
    </div>
  );
};

const TaskCreateModal = ({
  canAssignTasks,
  form,
  isSubmitting,
  members,
  onChange,
  onClose,
  onSubmit,
}) => (
  <div className="task-modal-backdrop">
    <form className="task-modal-card" onSubmit={onSubmit}>
      <div className="task-modal-header">
        <div>
          <span className="task-modal-kicker">
            <Icon name="add_task" />
            Task mới
          </span>
          <h2>Tạo công việc rõ người, rõ hạn</h2>
          <p>Điền thông tin đủ để người nhận có thể bắt tay vào làm ngay.</p>
        </div>
        <button type="button" onClick={onClose} className="task-icon-button">
          <Icon name="close" />
        </button>
      </div>

      <div className="task-modal-body">
        <label className="task-field">
          <span>Tiêu đề</span>
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            maxLength={255}
            placeholder="Ví dụ: Hoàn thiện tài liệu API cho nhóm mobile"
            required
          />
        </label>

        <label className="task-field">
          <span>Mô tả</span>
          <textarea
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            rows={4}
            maxLength={5000}
            placeholder="Bối cảnh, đầu ra mong muốn, link tài liệu hoặc tiêu chí hoàn thành."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="task-field">
            <span>Ưu tiên</span>
            <select
              value={form.priority}
              onChange={(event) =>
                onChange({ ...form, priority: event.target.value })
              }
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>

          <label className="task-field">
            <span>Hạn hoàn thành</span>
            <input
              type="date"
              value={form.endAt}
              onChange={(event) => onChange({ ...form, endAt: event.target.value })}
            />
          </label>
        </div>

        <div className="task-status-picker">
          {TASK_STATUSES.filter((status) => status.id !== "cancelled").map((status) => (
            <button
              key={status.id}
              type="button"
              onClick={() => onChange({ ...form, status: status.id })}
              className={form.status === status.id ? "is-selected" : ""}
              style={{
                "--task-status-color": status.accent,
                "--task-status-bg": status.soft,
              }}
            >
              <Icon name={status.icon} />
              {status.shortLabel}
            </button>
          ))}
        </div>

        {canAssignTasks && (
          <div className="task-field">
            <span>Người phụ trách</span>
            <TaskMemberPicker
              members={members}
              onChange={(assigneeIds) => onChange({ ...form, assigneeIds })}
              selectedIds={form.assigneeIds}
            />
          </div>
        )}

        <label className="task-field">
          <span>Checklist</span>
          <textarea
            value={form.checklistText}
            onChange={(event) =>
              onChange({ ...form, checklistText: event.target.value })
            }
            rows={4}
            placeholder="Mỗi dòng là một đầu việc nhỏ. Tối đa 20 dòng."
          />
        </label>
      </div>

      <div className="task-modal-footer">
        <button type="button" onClick={onClose} className="task-secondary-button">
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !form.title.trim()}
          className="task-primary-button"
        >
          <Icon name={isSubmitting ? "progress_activity" : "add_task"} />
          Tạo task
        </button>
      </div>
    </form>
  </div>
);

const TaskDrawer = ({
  assignableMembers,
  detailForm,
  isSaving,
  newChecklistTitle,
  onAddAssignee,
  onAddChecklist,
  onChangeDetailForm,
  onChangeStatus,
  onClose,
  onDelete,
  onDeleteChecklist,
  onRemoveAssignee,
  onSave,
  onSetNewChecklistTitle,
  onToggleChecklist,
  selectedAssigneeId,
  setSelectedAssigneeId,
  task,
}) => {
  if (!task) return null;

  const status = getTaskStatusMeta(task.status);
  const canEdit = Boolean(task.permissions?.canEdit);
  const canAssign = Boolean(task.permissions?.canAssign);
  const canDelete = Boolean(task.permissions?.canDelete);
  const canChangeStatus = Boolean(task.permissions?.canChangeStatus);
  const checklistProgress = getChecklistProgress(task);

  return (
    <aside className="task-drawer">
      <div className="task-drawer-panel">
        <div className="task-drawer-header" style={{ "--task-drawer-accent": status.accent }}>
          <div>
            <span className="task-drawer-eyebrow">
              <Icon name={status.icon} />
              {status.label} - #{getTaskShortId(task)}
            </span>
            <h2>{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="task-icon-button">
            <Icon name="close" />
          </button>
        </div>

        <div className="task-drawer-body">
          <section className="task-drawer-section task-drawer-brief">
            <div>
              <span>Tiến độ checklist</span>
              <strong>{checklistProgress.percent}%</strong>
            </div>
            <div>
              <span>Hạn</span>
              <strong>{formatDueDistance(task)}</strong>
            </div>
            <div>
              <span>Ưu tiên</span>
              <strong>{getTaskPriorityMeta(task.priority).label}</strong>
            </div>
          </section>

          {canEdit ? (
            <div className="task-drawer-editor">
              <label className="task-field">
                <span>Tiêu đề</span>
                <input
                  value={detailForm.title}
                  onChange={(event) =>
                    onChangeDetailForm({ ...detailForm, title: event.target.value })
                  }
                />
              </label>
              <label className="task-field">
                <span>Mô tả</span>
                <textarea
                  value={detailForm.description}
                  rows={5}
                  onChange={(event) =>
                    onChangeDetailForm({
                      ...detailForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="task-field">
                  <span>Ưu tiên</span>
                  <select
                    value={detailForm.priority}
                    onChange={(event) =>
                      onChangeDetailForm({
                        ...detailForm,
                        priority: event.target.value,
                      })
                    }
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="task-field">
                  <span>Hạn hoàn thành</span>
                  <input
                    type="date"
                    value={detailForm.endAt}
                    onChange={(event) =>
                      onChangeDetailForm({ ...detailForm, endAt: event.target.value })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || !detailForm.title.trim()}
                className="task-primary-button"
              >
                <Icon name={isSaving ? "progress_activity" : "save"} />
                Lưu thay đổi
              </button>
            </div>
          ) : (
            <div className="task-readonly-block">
              <p>{task.description || "Chưa có mô tả."}</p>
            </div>
          )}

          <section className="task-drawer-section">
            <div className="task-drawer-section-header">
              <h3>Trạng thái</h3>
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <div className="task-status-picker">
              {TASK_STATUSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!canChangeStatus || task.status === item.id}
                  onClick={() => onChangeStatus(item.id)}
                  className={task.status === item.id ? "is-selected" : ""}
                  style={{
                    "--task-status-color": item.accent,
                    "--task-status-bg": item.soft,
                  }}
                >
                  <Icon name={item.icon} />
                  {item.shortLabel}
                </button>
              ))}
            </div>
          </section>

          <section className="task-drawer-section">
            <div className="task-drawer-section-header">
              <h3>Người phụ trách</h3>
              <span>{task.assignees?.length || 0}</span>
            </div>
            <div className="grid gap-2">
              {(task.assignees || []).length ? (
                task.assignees.map((assignment, index) => (
                  <div
                    key={assignment.userId || assignment.id || index}
                    className="task-assignee-row"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar user={assignment.user} />
                      <div className="min-w-0">
                        <p>{assignment.user?.fullName || assignment.user?.email || "Thành viên"}</p>
                        <span>{assignment.user?.position || "WorkHub member"}</span>
                      </div>
                    </div>
                    {canAssign && (
                      <button
                        type="button"
                        onClick={() => onRemoveAssignee(assignment.userId)}
                        className="task-icon-button task-icon-button--rose"
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="task-empty-inline">Chưa gán thành viên.</div>
              )}
            </div>

            {canAssign && assignableMembers.length > 0 && (
              <div className="task-inline-composer">
                <select
                  value={selectedAssigneeId}
                  onChange={(event) => setSelectedAssigneeId(event.target.value)}
                  className="task-compact-select"
                >
                  <option value="">Chọn thành viên</option>
                  {assignableMembers.map((member) => {
                    const memberId = getMemberUserId(member);
                    return (
                      <option key={memberId} value={memberId}>
                        {getMemberName(member)}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={onAddAssignee}
                  disabled={!selectedAssigneeId}
                  className="task-icon-button task-icon-button--blue"
                >
                  <Icon name="person_add" />
                </button>
              </div>
            )}
          </section>

          <section className="task-drawer-section">
            <div className="task-drawer-section-header">
              <h3>Checklist</h3>
              <span>
                {checklistProgress.done}/{checklistProgress.total}
              </span>
            </div>
            <div className="grid gap-2">
              {(task.checklist || []).length ? (
                task.checklist.map((item) => (
                  <div key={item.id} className="task-checklist-row">
                    <button
                      type="button"
                      onClick={() => onToggleChecklist(item)}
                      disabled={!canEdit}
                      className={item.isDone ? "is-done" : ""}
                    >
                      <Icon name={item.isDone ? "check_circle" : "radio_button_unchecked"} />
                    </button>
                    <span className={item.isDone ? "line-through" : ""}>{item.title}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteChecklist(item)}
                        className="task-icon-button task-icon-button--ghost"
                      >
                        <Icon name="delete" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="task-empty-inline">Chưa có checklist.</div>
              )}
            </div>
            {canEdit && (
              <div className="task-inline-composer">
                <input
                  value={newChecklistTitle}
                  onChange={(event) => onSetNewChecklistTitle(event.target.value)}
                  className="task-compact-input"
                  placeholder="Thêm đầu việc nhỏ"
                />
                <button
                  type="button"
                  onClick={onAddChecklist}
                  disabled={!newChecklistTitle.trim()}
                  className="task-icon-button task-icon-button--blue"
                >
                  <Icon name="add" />
                </button>
              </div>
            )}
          </section>

          <section className="task-drawer-section task-meta-grid">
            <div>
              <span>Người tạo</span>
              <strong>{task.creator?.fullName || "Không rõ"}</strong>
            </div>
            <div>
              <span>Cập nhật</span>
              <strong>{formatTaskDate(task.updatedAt)}</strong>
            </div>
            <div>
              <span>Mã task</span>
              <strong>#{getTaskShortId(task)}</strong>
            </div>
          </section>
        </div>

        {canDelete && (
          <div className="task-drawer-footer">
            <button type="button" onClick={onDelete} className="task-danger-button">
              <Icon name="delete" />
              Xóa task
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

const TaskLaneStrip = ({
  focusStatusId,
  onSelectStatus,
  tasksByStatus,
  totalVisibleTasks,
}) => (
  <section className="task-lane-strip" aria-label="Lọc theo trạng thái">
    <button
      type="button"
      onClick={() => onSelectStatus("all")}
      className={focusStatusId === "all" ? "is-selected" : ""}
    >
      <Icon name="dashboard" />
      <span>Tất cả</span>
      <strong>{totalVisibleTasks}</strong>
    </button>
    {TASK_STATUSES.map((status) => (
      <button
        key={status.id}
        type="button"
        onClick={() => onSelectStatus(status.id)}
        className={focusStatusId === status.id ? "is-selected" : ""}
        style={{ "--lane-color": status.accent, "--lane-bg": status.soft }}
      >
        <Icon name={status.icon} />
        <span>{status.label}</span>
        <strong>{tasksByStatus[status.id]?.length || 0}</strong>
      </button>
    ))}
  </section>
);

const TaskCommandBar = ({
  canViewOrganizationTasks,
  filters,
  hasActiveFilters,
  members,
  onCreateTask,
  onRefresh,
  onResetFilters,
  onSetFilters,
  quickFilter,
  quickFilterCounts,
  setQuickFilter,
  setSortBy,
  setViewMode,
  sortBy,
  viewMode,
}) => (
  <section className="task-command-bar">
    <div className="task-command-row">
      <label className="task-search">
        <Icon name="search" />
        <input
          value={filters.search}
          onChange={(event) =>
            onSetFilters((current) => ({ ...current, search: event.target.value }))
          }
          placeholder="Tìm task, mô tả hoặc người phụ trách"
        />
      </label>

      <div className="task-view-switcher" aria-label="Chế độ xem">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setViewMode(mode.id)}
            className={viewMode === mode.id ? "is-selected" : ""}
          >
            <Icon name={mode.icon} />
            {mode.label}
          </button>
        ))}
      </div>

      <button type="button" onClick={onRefresh} className="task-secondary-button">
        <Icon name="refresh" />
        Làm mới
      </button>
      {onCreateTask && (
        <button type="button" onClick={onCreateTask} className="task-primary-button">
          <Icon name="add_task" />
          Tạo task
        </button>
      )}
    </div>

    <div className="task-command-row task-command-row--filters">
      <div className="task-quick-filters">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setQuickFilter(filter.id)}
            className={quickFilter === filter.id ? "is-selected" : ""}
          >
            <Icon name={filter.icon} />
            <span>{filter.label}</span>
            <strong>{quickFilterCounts[filter.id] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="task-filter-controls">
        <div className="task-segmented">
          <button
            type="button"
            onClick={() => onSetFilters((current) => ({ ...current, scope: "all" }))}
            className={filters.scope === "all" ? "is-selected" : ""}
          >
            Tổ chức
          </button>
          <button
            type="button"
            onClick={() => onSetFilters((current) => ({ ...current, scope: "mine" }))}
            className={filters.scope === "mine" ? "is-selected" : ""}
          >
            Của tôi
          </button>
        </div>

        <select
          value={filters.priority}
          onChange={(event) =>
            onSetFilters((current) => ({ ...current, priority: event.target.value }))
          }
          className="task-toolbar-select"
        >
          <option value="all">Mọi ưu tiên</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority.id} value={priority.id}>
              {priority.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="task-toolbar-select"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {canViewOrganizationTasks && members.length > 0 && (
          <select
            value={filters.assigneeId}
            onChange={(event) =>
              onSetFilters((current) => ({
                ...current,
                assigneeId: event.target.value,
              }))
            }
            className="task-toolbar-select"
          >
            <option value="all">Mọi phụ trách</option>
            <option value="mine">Liên quan tới tôi</option>
            {members.map((member) => {
              const memberId = getMemberUserId(member);
              return (
                <option key={memberId} value={memberId}>
                  {getMemberName(member)}
                </option>
              );
            })}
          </select>
        )}

        {hasActiveFilters && (
          <button type="button" onClick={onResetFilters} className="task-reset-button">
            <Icon name="restart_alt" />
            Xóa lọc
          </button>
        )}
      </div>
    </div>
  </section>
);

const TaskBoardView = ({
  displayStatuses,
  draggingTaskId,
  dropTargetStatus,
  onCardClick,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragStart,
  onDrop,
  onQuickStatusChange,
  tasksByStatus,
}) => (
  <section className="task-board" aria-label="Kanban task board">
    {displayStatuses.map((status) => (
      <TaskColumn
        key={status.id}
        draggingTaskId={draggingTaskId}
        isDropTarget={dropTargetStatus === status.id}
        onCardClick={onCardClick}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onQuickStatusChange={onQuickStatusChange}
        status={status}
        tasks={tasksByStatus[status.id] || []}
      />
    ))}
  </section>
);

const TaskListView = ({ onCardClick, onQuickStatusChange, tasks }) => (
  <section className="task-list-view" aria-label="Danh sách task">
    <div className="task-list-head">
      <span>Công việc</span>
      <span>Trạng thái</span>
      <span>Phụ trách</span>
      <span>Hạn</span>
      <span>Tiến độ</span>
    </div>
    {tasks.map((task) => {
      const checklistProgress = getChecklistProgress(task);
      return (
        <article
          key={getTaskId(task)}
          className="task-list-row"
          onClick={() => onCardClick(task)}
        >
          <div className="task-list-title">
            <span>#{getTaskShortId(task)}</span>
            <h3>{task.title}</h3>
            {task.description && <p>{task.description}</p>}
          </div>
          <div>
            <select
              value={task.status}
              disabled={!task.permissions?.canChangeStatus}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onQuickStatusChange(task, event.target.value)}
              className="task-status-select"
            >
              {TASK_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="task-list-assignees">
            <AvatarStack assignees={task.assignees || []} max={3} />
            <span>{getTaskAssigneeLabel(task)}</span>
          </div>
          <div className="task-list-due">
            <TaskDueBadge task={task} />
          </div>
          <div className="task-list-progress">
            <strong>{checklistProgress.percent}%</strong>
            <div className="task-progress-track">
              <span
                className="task-progress-bar"
                style={{ width: `${checklistProgress.percent}%` }}
              />
            </div>
          </div>
        </article>
      );
    })}
  </section>
);

const TaskFocusView = ({
  focusStatus,
  onCardClick,
  onQuickStatusChange,
  sortedTasks,
  tasks,
}) => {
  const focusMeta = getTaskStatusMeta(focusStatus);
  const overdueTasks = sortedTasks.filter((task) => getDueState(task) === "overdue");
  const dueSoonTasks = sortedTasks.filter((task) => getDueState(task) === "soon");

  return (
    <section className="task-focus-view">
      <div
        className="task-focus-main"
        style={{
          "--task-focus-color": focusMeta.accent,
          "--task-focus-bg": focusMeta.soft,
        }}
      >
        <header className="task-focus-header">
          <span className="task-focus-icon">
            <Icon name={focusMeta.icon} />
          </span>
          <div>
            <p>Luồng đang tập trung</p>
            <h2>{focusMeta.label}</h2>
          </div>
          <strong>{tasks.length}</strong>
        </header>

        <div className="task-focus-stack">
          {tasks.length ? (
            tasks.map((task) => (
              <TaskCard
                key={getTaskId(task)}
                isDragging={false}
                onClick={() => onCardClick(task)}
                onDragEnd={() => {}}
                onDragStart={() => {}}
                onQuickStatusChange={onQuickStatusChange}
                task={task}
              />
            ))
          ) : (
            <div className="task-focus-empty">
              <Icon name="done_all" />
              <h3>Cột này đang sạch</h3>
              <p>Chọn một trạng thái khác hoặc tạo task mới để bắt đầu.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="task-focus-side">
        <section>
          <h3>Cần xử lý trước</h3>
          <div className="task-mini-list">
            {[...overdueTasks, ...dueSoonTasks]
              .filter((task, index, array) =>
                array.findIndex((item) => getTaskId(item) === getTaskId(task)) === index,
              )
              .slice(0, 6)
              .map((task) => (
                <button key={getTaskId(task)} type="button" onClick={() => onCardClick(task)}>
                  <span>{task.title}</span>
                  <small>{formatDueDistance(task)}</small>
                </button>
              ))}
            {!overdueTasks.length && !dueSoonTasks.length && (
              <div className="task-empty-inline">Không có việc gấp trong bộ lọc này.</div>
            )}
          </div>
        </section>
      </aside>
    </section>
  );
};

const TaskInsightPanel = ({
  insights,
  onSelectQuickFilter,
  sortedTasks,
  workload,
}) => (
  <aside className="task-insight-panel">
    <section className="task-insight-card task-insight-card--risk">
      <div className="task-insight-header">
        <span>
          <Icon name="radar" />
        </span>
        <div>
          <h3>Tín hiệu rủi ro</h3>
          <p>Những điểm dễ làm nghẽn luồng việc</p>
        </div>
      </div>
      <div className="task-risk-grid">
        <button type="button" onClick={() => onSelectQuickFilter("overdue")}>
          <strong>{insights.overdue}</strong>
          <span>Quá hạn</span>
        </button>
        <button type="button" onClick={() => onSelectQuickFilter("blocked")}>
          <strong>{insights.blocked}</strong>
          <span>Đang vướng</span>
        </button>
        <button type="button" onClick={() => onSelectQuickFilter("unassigned")}>
          <strong>{insights.unassigned}</strong>
          <span>Chưa giao</span>
        </button>
      </div>
    </section>

    <section className="task-insight-card">
      <div className="task-insight-header">
        <span>
          <Icon name="bolt" />
        </span>
        <div>
          <h3>Hàng đợi ưu tiên</h3>
          <p>Task cần nhìn ngay</p>
        </div>
      </div>
      <div className="task-mini-list">
        {sortedTasks
          .filter((task) =>
            ["urgent", "high"].includes(task.priority) ||
            ["overdue", "soon"].includes(getDueState(task)),
          )
          .slice(0, 5)
          .map((task) => (
            <button key={getTaskId(task)} type="button">
              <span>{task.title}</span>
              <small>{getTaskPriorityMeta(task.priority).label} - {formatDueDistance(task)}</small>
            </button>
          ))}
        {!sortedTasks.length && (
          <div className="task-empty-inline">Chưa có task trong bộ lọc.</div>
        )}
      </div>
    </section>

    <section className="task-insight-card">
      <div className="task-insight-header">
        <span>
          <Icon name="groups" />
        </span>
        <div>
          <h3>Tải việc</h3>
          <p>Nhóm người đang gánh nhiều task</p>
        </div>
      </div>
      <div className="task-workload-list">
        {workload.length ? (
          workload.map((item) => (
            <div key={item.id}>
              <Avatar user={item.user} />
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
          ))
        ) : (
          <div className="task-empty-inline">Chưa có dữ liệu phân công.</div>
        )}
      </div>
    </section>
  </aside>
);

const TasksPage = () => {
  const { user } = useAuth();
  const message = useWorkHubToast();
  const activeOrganization = user?.activeOrganization;
  const organizationPermissions = activeOrganization?.permissions || {};
  const currentUserId = getUserId(user);
  const canViewAssignedTasks = Boolean(
    user?.role === "admin" ||
      activeOrganization?.isOwner ||
      organizationPermissions.manageOrganization ||
      organizationPermissions.viewAssignedTasks ||
      organizationPermissions.viewOrganizationTasks,
  );
  const canViewOrganizationTasks = Boolean(
    user?.role === "admin" ||
      activeOrganization?.isOwner ||
      organizationPermissions.manageOrganization ||
      organizationPermissions.viewOrganizationTasks,
  );
  const canCreateTasks = Boolean(
    user?.role === "admin" ||
      activeOrganization?.isOwner ||
      organizationPermissions.manageOrganization ||
      organizationPermissions.createTasks,
  );
  const canAssignTasks = Boolean(
    user?.role === "admin" ||
      activeOrganization?.isOwner ||
      organizationPermissions.manageOrganization ||
      organizationPermissions.manageTasks ||
      organizationPermissions.assignTasks,
  );
  const canViewInsights = Boolean(
    user?.role === "admin" ||
      activeOrganization?.isOwner ||
      organizationPermissions.manageOrganization ||
      organizationPermissions.viewTaskInsights,
  );

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    priority: "all",
    scope: "all",
    assigneeId: "all",
  });
  const [quickFilter, setQuickFilter] = useState("all");
  const [viewMode, setViewMode] = useState("board");
  const [focusStatusId, setFocusStatusId] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState("");
  const [dropTargetStatus, setDropTargetStatus] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailForm, setDetailForm] = useState(EMPTY_TASK_FORM);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");

  const replaceTask = useCallback((nextTask) => {
    if (!nextTask) return;
    const nextTaskId = getTaskId(nextTask);
    setTasks((current) => {
      const exists = current.some((task) => getTaskId(task) === nextTaskId);
      if (!exists) return [nextTask, ...current];
      return current.map((task) => (getTaskId(task) === nextTaskId ? nextTask : task));
    });
    setSelectedTask((current) =>
      current && getTaskId(current) === nextTaskId ? nextTask : current,
    );
  }, []);

  const loadTasks = useCallback(async () => {
    if (!canViewAssignedTasks) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = {
        page: 1,
        size: 200,
      };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.priority !== "all") params.priority = filters.priority;
      if (filters.assigneeId !== "all" && filters.assigneeId !== "mine") {
        params.assigneeId = filters.assigneeId;
      }

      const payload = await getTasks(params);
      setTasks(payload.content || []);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      message.error(getErrorMessage(error, "Không thể tải bảng công việc"), {
        description: "Danh sách task của tổ chức chưa được tải.",
      });
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [canViewAssignedTasks, filters.assigneeId, filters.priority, filters.search, message]);

  const loadSummary = useCallback(async () => {
    if (!canViewInsights) {
      setSummary(null);
      return;
    }

    try {
      setSummary(await getTaskSummary());
    } catch (error) {
      console.error("Failed to load task summary:", error);
      setSummary(null);
    }
  }, [canViewInsights]);

  const loadMembers = useCallback(async () => {
    if (!activeOrganization?.id || (!canAssignTasks && !canViewOrganizationTasks)) {
      setMembers([]);
      return;
    }

    try {
      const payload = await getOrganizationMembers(activeOrganization.id, {
        status: "active",
        page: 1,
        size: 100,
      });
      setMembers(payload.content || []);
    } catch (error) {
      console.error("Failed to load task members:", error);
      setMembers([]);
    }
  }, [activeOrganization?.id, canAssignTasks, canViewOrganizationTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!selectedTask) return;
    setDetailForm({
      title: selectedTask.title || "",
      description: selectedTask.description || "",
      priority: selectedTask.priority || "medium",
      status: selectedTask.status || "todo",
      endAt: toDateInputValue(selectedTask.endAt),
      assigneeIds: selectedTask.assigneeIds || [],
      checklistText: "",
    });
    setNewChecklistTitle("");
    setSelectedAssigneeId("");
  }, [selectedTask]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.scope === "mine" && !isUserTask(task, currentUserId)) {
        return false;
      }
      if (filters.assigneeId === "mine" && !isUserTask(task, currentUserId)) {
        return false;
      }
      if (filters.priority !== "all" && task.priority !== filters.priority) {
        return false;
      }
      if (!taskMatchesQuickFilter(task, quickFilter, currentUserId)) {
        return false;
      }
      return taskMatchesSearch(task, filters.search);
    });
  }, [
    currentUserId,
    filters.assigneeId,
    filters.priority,
    filters.scope,
    filters.search,
    quickFilter,
    tasks,
  ]);

  const sortedVisibleTasks = useMemo(
    () => sortTasks(visibleTasks, sortBy),
    [sortBy, visibleTasks],
  );

  const tasksByStatus = useMemo(() => {
    const grouped = TASK_STATUSES.reduce(
      (acc, status) => ({
        ...acc,
        [status.id]: [],
      }),
      {},
    );
    sortedVisibleTasks.forEach((task) => {
      const status = TASK_STATUS_MAP[task.status] ? task.status : "todo";
      grouped[status].push(task);
    });
    return grouped;
  }, [sortedVisibleTasks]);

  const displayStatuses = useMemo(() => {
    if (focusStatusId === "all") return TASK_STATUSES;
    return TASK_STATUSES.filter((status) => status.id === focusStatusId);
  }, [focusStatusId]);

  const effectiveFocusStatusId =
    focusStatusId === "all" ? "in_progress" : focusStatusId;

  const personalMetrics = useMemo(() => {
    const mine = tasks.filter((task) => isUserTask(task, currentUserId));
    const done = mine.filter((task) => task.status === "done").length;
    const overdue = mine.filter((task) => getDueState(task) === "overdue").length;
    const open = mine.filter((task) => OPEN_STATUS_IDS.includes(task.status)).length;
    return { total: mine.length, done, open, overdue };
  }, [currentUserId, tasks]);

  const insights = useMemo(
    () => buildTaskInsights(sortedVisibleTasks),
    [sortedVisibleTasks],
  );

  const quickFilterCounts = useMemo(() => {
    return QUICK_FILTERS.reduce(
      (acc, filter) => ({
        ...acc,
        [filter.id]: tasks.filter((task) =>
          taskMatchesQuickFilter(task, filter.id, currentUserId),
        ).length,
      }),
      {},
    );
  }, [currentUserId, tasks]);

  const workload = useMemo(() => {
    const workloadMap = new Map();
    members.forEach((member) => {
      const memberUser = getMemberUser(member);
      const id = String(getMemberUserId(member));
      workloadMap.set(id, {
        count: 0,
        id,
        name: getMemberName(member),
        user: memberUser,
      });
    });

    sortedVisibleTasks.forEach((task) => {
      (task.assignees || []).forEach((assignment) => {
        const id = String(assignment.userId || assignment.user?.id || assignment.user?._id || "");
        if (!id) return;
        const current =
          workloadMap.get(id) || {
            count: 0,
            id,
            name: assignment.user?.fullName || assignment.user?.email || "Thành viên",
            user: assignment.user,
          };
        workloadMap.set(id, { ...current, count: current.count + 1 });
      });
    });

    return [...workloadMap.values()]
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [members, sortedVisibleTasks]);

  const assignableMembers = useMemo(() => {
    if (!selectedTask) return members;
    const assignedIds = new Set((selectedTask.assigneeIds || []).map(String));
    return members.filter((member) => !assignedIds.has(String(getMemberUserId(member))));
  }, [members, selectedTask]);

  const hasActiveFilters =
    filters.search ||
    filters.priority !== "all" ||
    filters.scope !== "all" ||
    filters.assigneeId !== "all" ||
    quickFilter !== "all" ||
    focusStatusId !== "all";

  const openTaskDetail = useCallback(async (task) => {
    const taskId = getTaskId(task);
    setSelectedTask(task);
    try {
      const payload = await getTaskById(taskId);
      replaceTask(payload);
      setSelectedTask(payload);
    } catch (error) {
      console.error("Failed to load task detail:", error);
    }
  }, [replaceTask]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!taskForm.title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload = await createTask({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        status: taskForm.status,
        endAt: fromDateInputValue(taskForm.endAt),
        assigneeIds: canAssignTasks ? taskForm.assigneeIds : [],
        checklist: parseChecklistText(taskForm.checklistText),
      });
      replaceTask(payload);
      setCreateModalOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
      loadSummary();
      message.success("Đã tạo công việc", {
        description: `${payload.title || taskForm.title} đã nằm trong bảng task.`,
      });
    } catch (error) {
      console.error("Failed to create task:", error);
      message.error(getErrorMessage(error, "Không thể tạo công việc"), {
        description: "Task chưa được lưu. Hãy kiểm tra quyền công việc của vai trò hiện tại.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTaskStatus = useCallback(
    async (task, nextStatus) => {
      const taskId = getTaskId(task);
      if (!taskId || task.status === nextStatus || !task.permissions?.canChangeStatus) {
        return;
      }

      const previousTasks = tasks;
      setTasks((current) =>
        current.map((item) =>
          getTaskId(item) === taskId ? { ...item, status: nextStatus } : item,
        ),
      );

      try {
        const payload = await updateTask(taskId, { status: nextStatus });
        replaceTask(payload);
        loadSummary();
      } catch (error) {
        console.error("Failed to update task status:", error);
        setTasks(previousTasks);
        message.error(getErrorMessage(error, "Không thể cập nhật trạng thái"), {
          description: "Trạng thái task chưa được thay đổi.",
        });
      }
    },
    [loadSummary, message, replaceTask, tasks],
  );

  const handleDragStart = (event, task) => {
    if (!task.permissions?.canChangeStatus) return;
    const taskId = getTaskId(task);
    setDraggingTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-task-id", taskId);
    event.dataTransfer.setData("text/plain", taskId);
  };

  const handleDrop = (event, nextStatus) => {
    event.preventDefault();
    const taskId =
      event.dataTransfer.getData("application/x-task-id") ||
      event.dataTransfer.getData("text/plain") ||
      draggingTaskId;
    const task = tasks.find((item) => getTaskId(item) === taskId);
    setDraggingTaskId("");
    setDropTargetStatus("");
    if (task) updateTaskStatus(task, nextStatus);
  };

  const handleSaveDetail = async () => {
    if (!selectedTask || !detailForm.title.trim() || isSavingDetail) return;
    const taskId = getTaskId(selectedTask);

    setIsSavingDetail(true);
    try {
      const payload = await updateTask(taskId, {
        title: detailForm.title.trim(),
        description: detailForm.description.trim(),
        priority: detailForm.priority,
        endAt: fromDateInputValue(detailForm.endAt),
      });
      replaceTask(payload);
      loadSummary();
      message.success("Đã lưu công việc", {
        description: "Nội dung task đã được cập nhật.",
      });
    } catch (error) {
      console.error("Failed to save task:", error);
      message.error(getErrorMessage(error, "Không thể lưu công việc"), {
        description: "Các thay đổi chưa được lưu.",
      });
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    const confirmed = await message.confirm({
      title: "Xóa công việc",
      description: selectedTask.title,
      confirmLabel: "Xóa",
      type: "warning",
    });
    if (!confirmed) return;

    const taskId = getTaskId(selectedTask);
    try {
      await deleteTask(taskId);
      setTasks((current) => current.filter((task) => getTaskId(task) !== taskId));
      setSelectedTask(null);
      loadSummary();
      message.success("Đã xóa công việc");
    } catch (error) {
      console.error("Failed to delete task:", error);
      message.error(getErrorMessage(error, "Không thể xóa công việc"));
    }
  };

  const refreshSelectedTask = async () => {
    if (!selectedTask) return null;
    const payload = await getTaskById(getTaskId(selectedTask));
    replaceTask(payload);
    setSelectedTask(payload);
    return payload;
  };

  const handleAddChecklist = async () => {
    if (!selectedTask || !newChecklistTitle.trim()) return;
    try {
      await addChecklistItem(getTaskId(selectedTask), {
        title: newChecklistTitle.trim(),
        order: selectedTask.checklist?.length || 0,
      });
      setNewChecklistTitle("");
      await refreshSelectedTask();
    } catch (error) {
      console.error("Failed to add checklist:", error);
      message.error(getErrorMessage(error, "Không thể thêm checklist"));
    }
  };

  const handleToggleChecklist = async (item) => {
    if (!selectedTask || !item?.id) return;
    try {
      await updateChecklistItem(getTaskId(selectedTask), item.id, {
        isDone: !item.isDone,
      });
      await refreshSelectedTask();
      loadSummary();
    } catch (error) {
      console.error("Failed to update checklist:", error);
      message.error(getErrorMessage(error, "Không thể cập nhật checklist"));
    }
  };

  const handleDeleteChecklist = async (item) => {
    if (!selectedTask || !item?.id) return;
    try {
      await deleteChecklistItem(getTaskId(selectedTask), item.id);
      await refreshSelectedTask();
    } catch (error) {
      console.error("Failed to delete checklist:", error);
      message.error(getErrorMessage(error, "Không thể xóa checklist"));
    }
  };

  const handleAddAssignee = async () => {
    if (!selectedTask || !selectedAssigneeId) return;
    try {
      const payload = await addTaskAssignees(getTaskId(selectedTask), [
        selectedAssigneeId,
      ]);
      replaceTask(payload);
      setSelectedTask(payload);
      setSelectedAssigneeId("");
      loadSummary();
    } catch (error) {
      console.error("Failed to add assignee:", error);
      message.error(getErrorMessage(error, "Không thể giao việc"));
    }
  };

  const handleRemoveAssignee = async (userId) => {
    if (!selectedTask || !userId) return;
    try {
      const payload = await removeTaskAssignee(getTaskId(selectedTask), userId);
      replaceTask(payload);
      setSelectedTask(payload);
      loadSummary();
    } catch (error) {
      console.error("Failed to remove assignee:", error);
      message.error(getErrorMessage(error, "Không thể gỡ người phụ trách"));
    }
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      priority: "all",
      scope: "all",
      assigneeId: "all",
    });
    setQuickFilter("all");
    setFocusStatusId("all");
  };

  if (!canViewAssignedTasks) {
    return (
      <div className="task-page task-page-centered">
        <section className="task-access-state">
          <span>
            <Icon name="lock" />
          </span>
          <h1>Bạn chưa có quyền xem công việc</h1>
          <p>Vai trò hiện tại chưa được bật quyền công việc trong tổ chức.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`task-page task-page--${viewMode}`}>
      <section className="task-hero">
        <div className="task-hero-copy">
          <span className="task-eyebrow">
            <Icon name="hub" />
            {activeOrganization?.name || "WorkHub"}
          </span>
          <h1>Điều phối công việc</h1>
          <p>
            {canViewOrganizationTasks
              ? "Một bảng điều hành gọn, nhìn được rủi ro, tải việc và tiến độ của toàn tổ chức."
              : "Theo dõi các công việc bạn tạo, sở hữu hoặc được giao trong một không gian tập trung."}
          </p>
        </div>

        <div className="task-hero-panel">
          <div>
            <span>Hoàn thành</span>
            <strong>
              {canViewInsights && summary
                ? `${summary.totals?.completionRate || 0}%`
                : `${insights.completionRate}%`}
            </strong>
          </div>
          <div>
            <span>Việc mở</span>
            <strong>
              {canViewInsights && summary ? summary.totals?.open || 0 : insights.open}
            </strong>
          </div>
          <div>
            <span>Checklist</span>
            <strong>{insights.checklistRate}%</strong>
          </div>
        </div>
      </section>

      <section className="task-summary-grid">
        {canViewInsights && summary ? (
          <>
            <TaskSummaryCard
              caption="Toàn tổ chức"
              icon="assignment"
              label="Tổng task"
              tone="ink"
              value={summary.totals?.total || 0}
            />
            <TaskSummaryCard
              caption="Todo, doing, review, blocked"
              icon="bolt"
              label="Đang mở"
              tone="blue"
              value={summary.totals?.open || 0}
            />
            <TaskSummaryCard
              caption="Cần xử lý trước"
              icon="event_upcoming"
              label="Sắp đến hạn"
              tone="amber"
              value={summary.totals?.dueSoon || 0}
            />
            <TaskSummaryCard
              caption="Theo bộ lọc hiện tại"
              icon="verified"
              label="Hoàn thành"
              tone="green"
              value={`${summary.totals?.completionRate || 0}%`}
            />
          </>
        ) : (
          <>
            <TaskSummaryCard
              caption="Liên quan tới bạn"
              icon="assignment_ind"
              label="Việc của tôi"
              tone="ink"
              value={personalMetrics.total}
            />
            <TaskSummaryCard
              caption="Còn phải xử lý"
              icon="pending_actions"
              label="Đang mở"
              tone="blue"
              value={personalMetrics.open}
            />
            <TaskSummaryCard
              caption="Cần cứu ngay"
              icon="event_busy"
              label="Quá hạn"
              tone="rose"
              value={personalMetrics.overdue}
            />
            <TaskSummaryCard
              caption="Đã xong"
              icon="task_alt"
              label="Hoàn thành"
              tone="green"
              value={personalMetrics.done}
            />
          </>
        )}
      </section>

      <TaskCommandBar
        canViewOrganizationTasks={canViewOrganizationTasks}
        filters={filters}
        hasActiveFilters={Boolean(hasActiveFilters)}
        members={members}
        onCreateTask={
          canCreateTasks
            ? () => {
                setTaskForm(EMPTY_TASK_FORM);
                setCreateModalOpen(true);
              }
            : null
        }
        onRefresh={loadTasks}
        onResetFilters={resetFilters}
        onSetFilters={setFilters}
        quickFilter={quickFilter}
        quickFilterCounts={quickFilterCounts}
        setQuickFilter={setQuickFilter}
        setSortBy={setSortBy}
        setViewMode={setViewMode}
        sortBy={sortBy}
        viewMode={viewMode}
      />

      <TaskLaneStrip
        focusStatusId={focusStatusId}
        onSelectStatus={setFocusStatusId}
        tasksByStatus={tasksByStatus}
        totalVisibleTasks={sortedVisibleTasks.length}
      />

      <section className="task-workspace">
        <div className="task-workspace-main">
          {viewMode === "board" && (
            <TaskBoardView
              displayStatuses={displayStatuses}
              draggingTaskId={draggingTaskId}
              dropTargetStatus={dropTargetStatus}
              onCardClick={openTaskDetail}
              onDragEnd={() => {
                setDraggingTaskId("");
                setDropTargetStatus("");
              }}
              onDragEnter={(statusId) => setDropTargetStatus(statusId)}
              onDragLeave={() => setDropTargetStatus("")}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onQuickStatusChange={updateTaskStatus}
              tasksByStatus={tasksByStatus}
            />
          )}

          {viewMode === "list" && (
            <TaskListView
              onCardClick={openTaskDetail}
              onQuickStatusChange={updateTaskStatus}
              tasks={sortedVisibleTasks}
            />
          )}

          {viewMode === "focus" && (
            <TaskFocusView
              focusStatus={effectiveFocusStatusId}
              onCardClick={openTaskDetail}
              onQuickStatusChange={updateTaskStatus}
              sortedTasks={sortedVisibleTasks}
              tasks={tasksByStatus[effectiveFocusStatusId] || []}
            />
          )}

          {!isLoading && sortedVisibleTasks.length === 0 && (
            <section className="task-empty-state">
              <Icon name="view_kanban" />
              <h2>Không có công việc phù hợp</h2>
              <p>Bộ lọc hiện tại không có task nào. Xóa lọc hoặc tạo task mới.</p>
              <div className="task-empty-actions">
                <button type="button" onClick={resetFilters} className="task-secondary-button">
                  <Icon name="restart_alt" />
                  Xóa lọc
                </button>
                {canCreateTasks && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskForm(EMPTY_TASK_FORM);
                      setCreateModalOpen(true);
                    }}
                    className="task-primary-button"
                  >
                    <Icon name="add_task" />
                    Tạo task
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <TaskInsightPanel
          insights={insights}
          onSelectQuickFilter={setQuickFilter}
          sortedTasks={sortedVisibleTasks}
          workload={workload}
        />
      </section>

      {isLoading && (
        <div className="task-loading-overlay">
          <span />
          <p>Đang tải bảng công việc</p>
        </div>
      )}

      {createModalOpen && (
        <TaskCreateModal
          canAssignTasks={canAssignTasks}
          form={taskForm}
          isSubmitting={isSubmitting}
          members={members}
          onChange={setTaskForm}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreateTask}
        />
      )}

      {selectedTask && (
        <TaskDrawer
          assignableMembers={assignableMembers}
          detailForm={detailForm}
          isSaving={isSavingDetail}
          newChecklistTitle={newChecklistTitle}
          onAddAssignee={handleAddAssignee}
          onAddChecklist={handleAddChecklist}
          onChangeDetailForm={setDetailForm}
          onChangeStatus={(status) => updateTaskStatus(selectedTask, status)}
          onClose={() => setSelectedTask(null)}
          onDelete={handleDeleteTask}
          onDeleteChecklist={handleDeleteChecklist}
          onRemoveAssignee={handleRemoveAssignee}
          onSave={handleSaveDetail}
          onSetNewChecklistTitle={setNewChecklistTitle}
          onToggleChecklist={handleToggleChecklist}
          selectedAssigneeId={selectedAssigneeId}
          setSelectedAssigneeId={setSelectedAssigneeId}
          task={selectedTask}
        />
      )}
    </div>
  );
};

export default TasksPage;
