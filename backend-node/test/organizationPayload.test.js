import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInviteCode,
  getMembershipPermissions,
  getRolesFromMap,
  getMissingRequiredJoinAnswers,
  normalizeOrganizationJoinAnswers,
  normalizeOrganizationJoinQuestions,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationPayload,
  normalizeOrganizationRolePayload,
  normalizeOrganizationSettingsPayload,
  serializeOrganization,
} from "../src/services/organizationService.js";
import {
  DEFAULT_MEMBER_ROLE_KEY,
  hasOrganizationPermission,
  normalizeOrganizationAccentColor,
  normalizeRoleKey,
  normalizeRolePermissions,
} from "../src/utils/organizationPolicy.js";

const toRoleMapKey = (organizationId, roleKey) =>
  `${organizationId}:${normalizeRoleKey(roleKey) || DEFAULT_MEMBER_ROLE_KEY}`;

const toRoleIdMapKey = (roleId) => `id:${roleId}`;

const buildRoleMap = (roles = []) => {
  const roleMap = new Map();
  roles.forEach((role) => {
    roleMap.set(toRoleIdMapKey(role._id || role.id), role);
    roleMap.set(toRoleMapKey(role.organizationId, role.key), role);
  });
  return roleMap;
};

test("normalizeOrganizationPayload only includes optional fields when provided", () => {
  const payload = normalizeOrganizationPayload({ name: "  WorkHub Team  " });

  assert.deepEqual(payload, { name: "WorkHub Team" });
});

test("normalizeOrganizationPayload normalizes accent colors safely", () => {
  const payload = normalizeOrganizationPayload({
    name: "WorkHub Team",
    accentColor: "#0ea",
    description: "  Product workspace  ",
  });

  assert.equal(payload.accentColor, "#00eeaa");
  assert.equal(payload.description, "Product workspace");
});

test("normalizeOrganizationAccentColor falls back for unsupported values", () => {
  assert.equal(normalizeOrganizationAccentColor("url(javascript:bad)"), "#2563eb");
});

test("normalizeOrganizationRolePayload normalizes role badge colors safely", () => {
  const payload = normalizeOrganizationRolePayload({
    name: "  Moderator  ",
    color: "url(javascript:bad)",
    permissions: {
      manageJoinApproval: true,
      viewBannedMembers: true,
      viewMembers: true,
    },
  });

  assert.equal(payload.name, "Moderator");
  assert.equal(payload.color, "#2563eb");
  assert.equal(payload.permissions.manageJoinApproval, true);
  assert.equal(payload.permissions.viewBannedMembers, true);
  assert.equal(payload.permissions.viewMembers, true);
});

test("manager permission grants regular organization permissions", () => {
  const permissions = normalizeRolePermissions("moderator", {
    manageOrganization: true,
  });

  assert.equal(permissions.manageOrganization, true);
  assert.equal(permissions.manageJoinApproval, true);
  assert.equal(permissions.viewBannedMembers, true);
  assert.equal(permissions.manageRoles, true);
  assert.equal(
    hasOrganizationPermission({ permissions }, "manageMembers"),
    true,
  );
});

test("serializeOrganization includes the member favorite flag", () => {
  const payload = serializeOrganization(
    {
      _id: "organization-1",
      name: "WorkHub Team",
      slug: "workhub-team",
      settings: {},
    },
    {
      role: "member",
      status: "active",
      isFavorite: true,
    },
    {
      stats: {
        memberCount: 4,
        onlineCount: 2,
        pendingCount: 1,
      },
    },
  );

  assert.equal(payload.isFavorite, true);
  assert.equal(payload.memberCount, 4);
  assert.equal(payload.pendingCount, 1);
});

test("serializeOrganization treats ownership as separate from the visible role", () => {
  const payload = serializeOrganization(
    {
      _id: "organization-1",
      name: "WorkHub Team",
      slug: "workhub-team",
      ownerId: "user-1",
      settings: {},
    },
    {
      userId: "user-1",
      role: "thanh-vien",
      status: "active",
    },
    {
      role: {
        _id: "role-1",
        key: "thanh-vien",
        name: "Thành viên",
        color: "#64748b",
        permissions: { viewMembers: true },
      },
    },
  );

  assert.equal(payload.isOwner, true);
  assert.equal(payload.role, "thanh-vien");
  assert.equal(payload.roleLabel, "Thành viên");
  assert.equal(payload.permissions.manageRoles, true);
});

test("membership roles are sorted by organization role order and merge permissions", () => {
  const roles = [
    {
      _id: "role-low",
      organizationId: "organization-1",
      key: "editor",
      name: "Editor",
      sortOrder: 3,
      permissions: { manageDocuments: true },
    },
    {
      _id: "role-high",
      organizationId: "organization-1",
      key: "lead",
      name: "Lead",
      sortOrder: 1,
      permissions: { manageMembers: true },
    },
  ];
  const membership = {
    organizationId: "organization-1",
    roleId: "role-low",
    roleIds: ["role-low", "role-high"],
    role: "editor",
    status: "active",
  };
  const roleMap = buildRoleMap(roles);
  const sortedRoles = getRolesFromMap(membership, roleMap);
  const permissions = getMembershipPermissions(membership, roleMap);

  assert.deepEqual(
    sortedRoles.map((role) => role.key),
    ["lead", "editor"],
  );
  assert.equal(permissions.manageMembers, true);
  assert.equal(permissions.manageDocuments, true);
});

test("serializeOrganization exposes the highest ordered role first", () => {
  const roles = [
    {
      _id: "role-high",
      organizationId: "organization-1",
      key: "lead",
      name: "Lead",
      description: "Highest role",
      color: "#0ea5e9",
      permissions: { manageMembers: true },
    },
    {
      _id: "role-low",
      organizationId: "organization-1",
      key: "editor",
      name: "Editor",
      description: "Secondary role",
      color: "#22c55e",
      permissions: { manageDocuments: true },
    },
  ];
  const payload = serializeOrganization(
    {
      _id: "organization-1",
      name: "WorkHub Team",
      slug: "workhub-team",
      settings: {},
    },
    {
      roleId: "role-low",
      roleIds: ["role-low", "role-high"],
      role: "editor",
      status: "active",
    },
    { roles },
  );

  assert.equal(payload.roleId, "role-high");
  assert.equal(payload.roleLabel, "Lead");
  assert.deepEqual(
    payload.roles.map((role) => role.name),
    ["Lead", "Editor"],
  );
  assert.equal(payload.permissions.manageMembers, true);
  assert.equal(payload.permissions.manageDocuments, true);
});

test("normalizeOrganizationSettingsPayload accepts default role ids", () => {
  const payload = normalizeOrganizationSettingsPayload({
    defaultRoleId: "507f1f77bcf86cd799439011",
  });

  assert.equal(payload.defaultRoleId, "507f1f77bcf86cd799439011");
});

test("createInviteCode returns a short readable code", () => {
  const code = createInviteCode();

  assert.match(code, /^[A-Z0-9]+$/);
  assert.ok(code.length >= 7);
  assert.ok(code.length <= 12);
});

test("normalizeOrganizationInvitePayload keeps approval bypass flag", () => {
  const payload = normalizeOrganizationInvitePayload({
    bypassApproval: true,
    maxUses: 25,
  });

  assert.equal(payload.bypassApproval, true);
  assert.equal(payload.maxUses, 25);
});

test("normalizeOrganizationJoinQuestions keeps supported question types safely", () => {
  const questions = normalizeOrganizationJoinQuestions([
    {
      id: "why",
      type: "paragraph",
      label: "  Vì sao bạn muốn tham gia?  ",
      required: true,
    },
    {
      id: "source",
      type: "multiple_choice",
      label: "Bạn biết tổ chức từ đâu?",
      options: ["Bạn bè", { id: "search", label: "Tìm kiếm" }, ""],
    },
    {
      id: "rules",
      type: "rules",
      label: "Đồng ý quy định",
      description: "Không spam.",
    },
  ]);

  assert.equal(questions.length, 3);
  assert.equal(questions[0].label, "Vì sao bạn muốn tham gia?");
  assert.equal(questions[1].options.length, 2);
  assert.equal(questions[2].type, "rules");
});

test("normalizeOrganizationJoinAnswers detects missing required answers", () => {
  const questions = normalizeOrganizationJoinQuestions([
    { id: "why", type: "short_text", label: "Lý do", required: true },
    {
      id: "source",
      type: "multiple_choice",
      label: "Nguồn",
      required: true,
      options: [{ id: "friend", label: "Bạn bè" }],
    },
    { id: "rules", type: "rules", label: "Quy định", required: true },
  ]);

  const answers = normalizeOrganizationJoinAnswers(questions, {
    why: "Muốn làm việc cùng nhóm",
    source: "friend",
    rules: true,
  });

  assert.equal(answers[1].value, "Bạn bè");
  assert.deepEqual(getMissingRequiredJoinAnswers(questions, answers), []);
  const incompleteAnswers = normalizeOrganizationJoinAnswers(questions, {
    source: "friend",
    rules: false,
  });

  assert.equal(getMissingRequiredJoinAnswers(questions, incompleteAnswers).length, 2);
});
