import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateTask,
  canViewOrganizationTasks,
  canViewTaskInsights,
} from "../src/services/taskPermissionService.js";
import { normalizeRolePermissions } from "../src/utils/organizationPolicy.js";

const buildUser = (permissions = {}, overrides = {}) => ({
  _id: "user-1",
  role: "user",
  activeOrganizationId: "organization-1",
  activeOrganizationPermissions: permissions,
  activeOrganizationIsOwner: false,
  ...overrides,
});

test("default member task permissions allow assigned-task board and task creation", () => {
  const permissions = normalizeRolePermissions("thanh-vien");
  const user = buildUser(permissions);

  assert.equal(permissions.viewAssignedTasks, true);
  assert.equal(permissions.createTasks, true);
  assert.equal(canCreateTask(user), true);
  assert.equal(canViewOrganizationTasks(user), false);
  assert.equal(canViewTaskInsights(user), false);
});

test("organization task visibility and insights require explicit role permissions", () => {
  const user = buildUser({
    viewAssignedTasks: true,
    createTasks: true,
    viewOrganizationTasks: true,
    viewTaskInsights: true,
  });

  assert.equal(canViewOrganizationTasks(user), true);
  assert.equal(canViewTaskInsights(user), true);
});

test("system admins still require an active organization for task permissions", () => {
  const user = buildUser({}, { role: "admin", activeOrganizationId: null });

  assert.equal(canCreateTask(user), false);
  assert.equal(canViewOrganizationTasks(user), false);
  assert.equal(canViewTaskInsights(user), false);
});
