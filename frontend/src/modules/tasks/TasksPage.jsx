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

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const getMemberUser = (member) => member?.user || member;

const getMemberUserId = (member) =>
  getMemberUser(member)?.id || getMemberUser(member)?._id || member?.userId || member?.id || "";

const getMemberName = (member) =>
  getMemberUser(member)?.fullName ||
  getMemberUser(member)?.name ||
  getMemberUser(member)?.email ||
  "Thành viên";

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
      <span className="task-avatar-empty">
        <Icon name="person_add" />
      </span>
    );
  }

  return (
    <div className="task-avatar-stack">
      {visibleAssignees.map((assignment) => (
        <Avatar
          key={assignment.userId || assignment.id}
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
      {formatTaskDate(task.endAt)}
    </span>
  );
};

const TaskCard = ({ isDragging, onClick, onDragEnd, onDragStart, task }) => {
  const status = getTaskStatusMeta(task.status);
  const canDrag = Boolean(task.permissions?.canChangeStatus);

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
      <div className="flex items-start justify-between gap-3">
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TaskPriorityBadge priority={task.priority} />
        <TaskDueBadge task={task} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span>Checklist</span>
          <span>{task.checklistProgress?.done || 0}/{task.checklistProgress?.total || 0}</span>
        </div>
        <div className="task-progress-track">
          <span
            className="task-progress-bar"
            style={{ width: `${task.checklistProgress?.percent || 0}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <AvatarStack assignees={task.assignees || []} />
        <span className="task-card-updated">
          <Icon name="schedule" />
          {formatTaskDate(task.updatedAt || task.createdAt)}
        </span>
      </div>
    </article>
  );
};

const TaskColumn = ({
  draggingTaskId,
  onCardClick,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragStart,
  onDrop,
  status,
  tasks,
}) => (
  <section
    className="task-column"
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
            task={task}
          />
        ))
      ) : (
        <div className="task-column-empty">
          <Icon name="inbox" />
          <span>Chưa có task</span>
        </div>
      )}
    </div>
  </section>
);

const TaskSummaryCard = ({ icon, label, tone, value }) => (
  <article className={`task-summary-card task-summary-card--${tone}`}>
    <span className="task-summary-icon">
      <Icon name={icon} />
    </span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
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

  return (
    <div className="task-member-picker">
      {members.map((member) => {
        const memberUser = getMemberUser(member);
        const memberId = getMemberUserId(member);
        const selected = selectedIds.includes(memberId);
        return (
          <button
            key={memberId}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(
                selected
                  ? selectedIds.filter((item) => item !== memberId)
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
          <h2>Tạo công việc</h2>
          <p>Bảng task của tổ chức</p>
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

  return (
    <aside className="task-drawer">
      <div className="task-drawer-panel">
        <div className="task-drawer-header" style={{ "--task-drawer-accent": status.accent }}>
          <div>
            <span className="task-drawer-eyebrow">
              <Icon name={status.icon} />
              {status.label}
            </span>
            <h2>{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="task-icon-button">
            <Icon name="close" />
          </button>
        </div>

        <div className="task-drawer-body">
          {canEdit ? (
            <div className="grid gap-4">
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
                task.assignees.map((assignment) => (
                  <div key={assignment.userId || assignment.id} className="task-assignee-row">
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
              <div className="mt-3 flex gap-2">
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
              <span>{task.checklistProgress?.percent || 0}%</span>
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
              <div className="mt-3 flex gap-2">
                <input
                  value={newChecklistTitle}
                  onChange={(event) => onSetNewChecklistTitle(event.target.value)}
                  className="task-compact-input"
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
              <span>Hạn</span>
              <strong>{formatTaskDate(task.endAt)}</strong>
            </div>
            <div>
              <span>Người tạo</span>
              <strong>{task.creator?.fullName || "Không rõ"}</strong>
            </div>
            <div>
              <span>Cập nhật</span>
              <strong>{formatTaskDate(task.updatedAt)}</strong>
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
      return taskMatchesSearch(task, filters.search);
    });
  }, [currentUserId, filters.assigneeId, filters.priority, filters.scope, filters.search, tasks]);

  const tasksByStatus = useMemo(() => {
    const grouped = TASK_STATUSES.reduce(
      (acc, status) => ({
        ...acc,
        [status.id]: [],
      }),
      {},
    );
    visibleTasks.forEach((task) => {
      const status = TASK_STATUS_MAP[task.status] ? task.status : "todo";
      grouped[status].push(task);
    });
    return grouped;
  }, [visibleTasks]);

  const personalMetrics = useMemo(() => {
    const mine = tasks.filter((task) => isUserTask(task, currentUserId));
    const done = mine.filter((task) => task.status === "done").length;
    const overdue = mine.filter((task) => getDueState(task) === "overdue").length;
    const open = mine.filter((task) =>
      ["todo", "in_progress", "blocked", "review"].includes(task.status),
    ).length;
    return { total: mine.length, done, open, overdue };
  }, [currentUserId, tasks]);

  const assignableMembers = useMemo(() => {
    if (!selectedTask) return members;
    const assignedIds = new Set((selectedTask.assigneeIds || []).map(String));
    return members.filter((member) => !assignedIds.has(String(getMemberUserId(member))));
  }, [members, selectedTask]);

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
    <div className="task-page">
      <section className="task-hero">
        <div className="task-hero-copy">
          <span className="task-eyebrow">
            <Icon name="hub" />
            {activeOrganization?.name || "WorkHub"}
          </span>
          <h1>Bảng công việc</h1>
          <p>
            {canViewOrganizationTasks
              ? "Theo dõi toàn bộ luồng việc, trạng thái và tải việc của tổ chức."
              : "Theo dõi các công việc bạn tạo, sở hữu hoặc được giao."}
          </p>
        </div>

        <div className="task-hero-actions">
          <button type="button" onClick={loadTasks} className="task-secondary-button">
            <Icon name="refresh" />
            Làm mới
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

      <section className="task-summary-grid">
        {canViewInsights && summary ? (
          <>
            <TaskSummaryCard
              icon="assignment"
              label="Tổng task"
              tone="blue"
              value={summary.totals?.total || 0}
            />
            <TaskSummaryCard
              icon="bolt"
              label="Đang mở"
              tone="teal"
              value={summary.totals?.open || 0}
            />
            <TaskSummaryCard
              icon="event_upcoming"
              label="Sắp đến hạn"
              tone="amber"
              value={summary.totals?.dueSoon || 0}
            />
            <TaskSummaryCard
              icon="verified"
              label="Hoàn thành"
              tone="green"
              value={`${summary.totals?.completionRate || 0}%`}
            />
          </>
        ) : (
          <>
            <TaskSummaryCard
              icon="assignment_ind"
              label="Việc của tôi"
              tone="blue"
              value={personalMetrics.total}
            />
            <TaskSummaryCard
              icon="pending_actions"
              label="Đang mở"
              tone="teal"
              value={personalMetrics.open}
            />
            <TaskSummaryCard
              icon="event_busy"
              label="Quá hạn"
              tone="rose"
              value={personalMetrics.overdue}
            />
            <TaskSummaryCard
              icon="task_alt"
              label="Hoàn thành"
              tone="green"
              value={personalMetrics.done}
            />
          </>
        )}
      </section>

      <section className="task-toolbar">
        <label className="task-search">
          <Icon name="search" />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
        </label>

        <div className="task-segmented">
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, scope: "all" }))}
            className={filters.scope === "all" ? "is-selected" : ""}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, scope: "mine" }))}
            className={filters.scope === "mine" ? "is-selected" : ""}
          >
            Của tôi
          </button>
        </div>

        <select
          value={filters.priority}
          onChange={(event) =>
            setFilters((current) => ({ ...current, priority: event.target.value }))
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

        {canViewOrganizationTasks && members.length > 0 && (
          <select
            value={filters.assigneeId}
            onChange={(event) =>
              setFilters((current) => ({
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
      </section>

      <section
        className={cx("task-board", dropTargetStatus && "task-board--dropping")}
        style={{ "--drop-target-status": dropTargetStatus }}
      >
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status.id}
            draggingTaskId={draggingTaskId}
            onCardClick={openTaskDetail}
            onDragEnd={() => {
              setDraggingTaskId("");
              setDropTargetStatus("");
            }}
            onDragEnter={(statusId) => setDropTargetStatus(statusId)}
            onDragLeave={() => setDropTargetStatus("")}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            status={status}
            tasks={tasksByStatus[status.id] || []}
          />
        ))}
      </section>

      {isLoading && (
        <div className="task-loading-overlay">
          <span />
          <p>Đang tải bảng công việc</p>
        </div>
      )}

      {!isLoading && visibleTasks.length === 0 && (
        <section className="task-empty-state">
          <Icon name="view_kanban" />
          <h2>Chưa có công việc phù hợp</h2>
          <p>Bộ lọc hiện tại không có task nào để hiển thị.</p>
        </section>
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
