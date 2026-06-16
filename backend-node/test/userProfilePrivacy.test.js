import assert from "node:assert/strict";
import test from "node:test";

import { formatScopedProfileRole } from "../src/presenters/userPresenter.js";

test("scoped profile roles do not expose organization membership details", () => {
  const payload = formatScopedProfileRole(
    {
      role: "admin",
      status: "active",
      joinedAt: new Date("2026-06-16T00:00:00.000Z"),
      organizationId: "private-organization-id",
      permissions: { manageMembers: true },
    },
    {
      key: "admin",
      name: "Quản trị",
      description: "Điều phối thành viên trong tổ chức.",
      color: "#2563eb",
      isSystem: true,
      permissions: { manageMembers: true },
    },
  );

  assert.deepEqual(Object.keys(payload).sort(), [
    "color",
    "description",
    "isSystem",
    "joinedAt",
    "key",
    "name",
    "status",
  ]);
  assert.equal(payload.name, "Quản trị");
  assert.equal(payload.organizationId, undefined);
  assert.equal(payload.permissions, undefined);
});
