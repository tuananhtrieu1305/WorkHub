import assert from "node:assert/strict";
import { test } from "node:test";

import permission from "../src/services/documentPermissionService.js";

const user = (overrides = {}) => ({
  _id: "user-1",
  activeOrganizationId: "org-1",
  activeOrganizationRole: "member",
  activeOrganizationPermissions: {},
  ...overrides,
});

const document = (overrides = {}) => ({
  _id: "doc-1",
  organizationId: "org-1",
  ownerId: "owner-1",
  createdBy: "owner-1",
  status: "active",
  deletedAt: null,
  permissions: {
    visibility: "organization",
    users: [],
  },
  ...overrides,
});

const folder = (overrides = {}) => ({
  _id: "folder-1",
  organizationId: "org-1",
  ownerId: "owner-1",
  createdBy: "owner-1",
  deletedAt: null,
  permissions: {
    visibility: "organization",
    users: [],
  },
  ...overrides,
});

test("organization-visible documents are readable only inside the active organization", () => {
  assert.equal(permission.canRead(user(), document()), true);
  assert.equal(
    permission.canRead(
      user({ activeOrganizationId: "org-2", role: "admin" }),
      document(),
    ),
    false,
  );
});

test("document owner can update and delete their own upload", () => {
  const owner = user({ _id: "owner-1" });

  assert.equal(permission.canEdit(owner, document()), true);
  assert.equal(permission.canDelete(owner, document()), true);
});

test("organization manageDocuments permission can manage documents from other uploaders", () => {
  const manager = user({
    activeOrganizationPermissions: {
      manageDocuments: true,
    },
  });

  assert.equal(permission.canRead(manager, document()), true);
  assert.equal(permission.canEdit(manager, document()), true);
  assert.equal(permission.canDelete(manager, document()), true);
});

test("shareDocuments can create share links without granting edit rights", () => {
  const sharer = user({
    activeOrganizationPermissions: {
      shareDocuments: true,
    },
  });

  assert.equal(permission.canShare(sharer, document()), true);
  assert.equal(permission.canEdit(sharer, document()), false);
});

test("members can upload into organization folders but cannot manage folders", () => {
  assert.equal(permission.canUploadToFolder(user(), folder()), true);
  assert.equal(permission.canManageFolder(user(), folder()), false);
});

test("document folder managers can manage folders and view insights", () => {
  const folderManager = user({
    activeOrganizationPermissions: {
      manageDocumentFolders: true,
      viewDocumentInsights: true,
    },
  });

  assert.equal(permission.canManageFolder(folderManager, folder()), true);
  assert.equal(permission.canViewDocumentInsights(folderManager), true);
});
