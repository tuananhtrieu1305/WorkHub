import assert from "node:assert/strict";
import test from "node:test";

import { getDropPlacement, moveRole } from "./organizationRoleOrder.js";

const roles = [
  { id: "owner", name: "Owner" },
  { id: "manager", name: "Manager" },
  { id: "member", name: "Member" },
];

test("getDropPlacement falls back when the drop element is gone", () => {
  assert.equal(getDropPlacement({ clientY: 20 }, null), "before");
  assert.equal(getDropPlacement({ clientY: 20 }, null, "after"), "after");
});

test("getDropPlacement reads pointer position against the target row", () => {
  const element = {
    getBoundingClientRect: () => ({ top: 100, height: 40 }),
  };

  assert.equal(getDropPlacement({ clientY: 110 }, element), "before");
  assert.equal(getDropPlacement({ clientY: 130 }, element), "after");
});

test("moveRole inserts a dragged role before or after the target role", () => {
  assert.deepEqual(
    moveRole(roles, "member", "owner", "before").map((role) => role.id),
    ["member", "owner", "manager"],
  );
  assert.deepEqual(
    moveRole(roles, "owner", "member", "after").map((role) => role.id),
    ["manager", "member", "owner"],
  );
});

test("moveRole returns the original array when order does not change", () => {
  assert.equal(moveRole(roles, "owner", "owner", "after"), roles);
  assert.equal(moveRole(roles, "missing", "owner", "before"), roles);
});
