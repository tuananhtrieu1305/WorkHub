import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInviteCode,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationPayload,
  serializeOrganization,
} from "../src/services/organizationService.js";
import { normalizeOrganizationAccentColor } from "../src/utils/organizationPolicy.js";

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
