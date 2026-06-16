import assert from "node:assert/strict";
import { __meetingPresenterTestables } from "../src/presenters/meetingPresenter.js";

const { buildReadableMeetingQuery, canReadMeeting } = __meetingPresenterTestables;

const user = {
  _id: "user-1",
  role: "member",
  activeOrganizationId: "org-1",
};

const historyQuery = buildReadableMeetingQuery(user, { status: "ended" });

assert.equal(historyQuery.organizationId, "org-1");
assert.equal(historyQuery.status, "ended");
assert.deepEqual(historyQuery.$or, [
  { createdBy: "user-1" },
  { hostUserId: "user-1" },
  {
    participants: {
      $elemMatch: {
        userId: "user-1",
        joinedAt: { $ne: null },
      },
    },
  },
]);

assert.equal(
  canReadMeeting(user, {
    organizationId: "org-1",
    status: "ended",
    createdBy: "other-user",
    hostUserId: "other-user",
    participants: [{ userId: "user-1", joinedAt: new Date() }],
  }),
  true,
);

assert.equal(
  canReadMeeting(user, {
    organizationId: "org-1",
    status: "ended",
    createdBy: "other-user",
    hostUserId: "other-user",
    participants: [{ userId: "user-1", joinedAt: null }],
  }),
  false,
);
