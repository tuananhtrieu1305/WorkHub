import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInviteCode,
  getMissingRequiredJoinAnswers,
  normalizeOrganizationJoinAnswers,
  normalizeOrganizationJoinQuestions,
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
