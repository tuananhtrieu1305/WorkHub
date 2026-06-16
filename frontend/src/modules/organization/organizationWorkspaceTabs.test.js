import assert from "node:assert/strict";
import test from "node:test";

import { getAvailableWorkspaceTabs } from "./organizationWorkspaceTabs.js";

const tabIds = (tabs) => tabs.map((tab) => tab.id);

test("regular member with manageRoles permission can see roles tab", () => {
  const tabs = getAvailableWorkspaceTabs(
    { permissions: { manageRoles: true } },
    { canManage: false },
  );

  assert.ok(tabIds(tabs).includes("roles"));
});

test("regular member without manageRoles permission cannot see roles tab", () => {
  const tabs = getAvailableWorkspaceTabs(
    { permissions: { viewMembers: true } },
    { canManage: false },
  );

  assert.equal(tabIds(tabs).includes("roles"), false);
});

test("manager still sees roles tab when manageRoles is present", () => {
  const tabs = getAvailableWorkspaceTabs(
    { permissions: { manageOrganization: true, manageRoles: true } },
    { canManage: true },
  );

  assert.ok(tabIds(tabs).includes("roles"));
});
