import test from "node:test";
import assert from "node:assert/strict";

import Task from "../src/models/Task.js";
import TaskAssignee from "../src/models/TaskAssignee.js";
import ChecklistItem from "../src/models/ChecklistItem.js";

const hasIndex = (model, fields, options = {}) => {
  return model.schema.indexes().some(([indexFields, indexOptions]) => {
    const fieldsMatch = JSON.stringify(indexFields) === JSON.stringify(fields);
    const optionsMatch = Object.entries(options).every(
      ([key, value]) => indexOptions[key] === value,
    );
    return fieldsMatch && optionsMatch;
  });
};

test("Task model defines fields, enums, timestamps, and planned indexes", () => {
  assert.ok(Task.schema.path("title"));
  assert.ok(Task.schema.path("description"));
  assert.ok(Task.schema.path("projectId"));
  assert.ok(Task.schema.path("departmentId"));
  assert.ok(Task.schema.path("createdBy"));
  assert.ok(Task.schema.path("ownerId"));
  assert.ok(Task.schema.path("startAt"));
  assert.ok(Task.schema.path("endAt"));
  assert.ok(Task.schema.path("completedAt"));
  assert.ok(Task.schema.path("archivedAt"));
  assert.ok(Task.schema.path("deletedAt"));

  assert.deepEqual(Task.schema.path("status").enumValues, [
    "todo",
    "in_progress",
    "blocked",
    "review",
    "done",
    "cancelled",
  ]);
  assert.deepEqual(Task.schema.path("priority").enumValues, [
    "low",
    "medium",
    "high",
    "urgent",
  ]);

  assert.ok(hasIndex(Task, { projectId: 1, status: 1, endAt: 1 }));
  assert.ok(hasIndex(Task, { departmentId: 1, status: 1, endAt: 1 }));
  assert.ok(hasIndex(Task, { deletedAt: 1, projectId: 1, status: 1, endAt: 1 }));
  assert.ok(hasIndex(Task, { deletedAt: 1, departmentId: 1, status: 1, endAt: 1 }));
  assert.ok(hasIndex(Task, { deletedAt: 1, createdBy: 1, createdAt: -1 }));
  assert.ok(hasIndex(Task, { deletedAt: 1, ownerId: 1, createdAt: -1 }));
  assert.ok(hasIndex(Task, { createdBy: 1, createdAt: -1 }));
  assert.ok(hasIndex(Task, { ownerId: 1, createdAt: -1 }));
  assert.ok(hasIndex(Task, { status: 1, endAt: 1 }));
  assert.ok(hasIndex(Task, { deletedAt: 1 }));
});

test("TaskAssignee model defines assignment state and uniqueness", () => {
  assert.ok(TaskAssignee.schema.path("taskId"));
  assert.ok(TaskAssignee.schema.path("userId"));
  assert.ok(TaskAssignee.schema.path("assignedBy"));
  assert.ok(TaskAssignee.schema.path("assignedAt"));
  assert.ok(TaskAssignee.schema.path("removedAt"));
  assert.deepEqual(TaskAssignee.schema.path("status").enumValues, [
    "assigned",
    "accepted",
    "declined",
    "completed",
  ]);

  assert.ok(hasIndex(TaskAssignee, { taskId: 1, userId: 1 }, { unique: true }));
  assert.ok(hasIndex(TaskAssignee, { userId: 1, removedAt: 1, assignedAt: -1 }));
});

test("ChecklistItem model defines task checklist fields and order index", () => {
  assert.ok(ChecklistItem.schema.path("taskId"));
  assert.ok(ChecklistItem.schema.path("title"));
  assert.ok(ChecklistItem.schema.path("isDone"));
  assert.ok(ChecklistItem.schema.path("order"));
  assert.ok(ChecklistItem.schema.path("createdBy"));
  assert.ok(ChecklistItem.schema.path("completedBy"));
  assert.ok(ChecklistItem.schema.path("completedAt"));

  assert.ok(hasIndex(ChecklistItem, { taskId: 1, order: 1 }));
});
