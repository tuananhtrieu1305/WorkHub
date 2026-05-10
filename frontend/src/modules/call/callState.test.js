import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTerminalCallStatus,
  normalizeMediaFailureReason,
  shouldCloseIncomingCall,
} from "./callState.js";

describe("call state helpers", () => {
  it("marks final call statuses as terminal", () => {
    assert.equal(isTerminalCallStatus("ended"), true);
    assert.equal(isTerminalCallStatus("failed"), true);
    assert.equal(isTerminalCallStatus("missed"), true);
    assert.equal(isTerminalCallStatus("active"), false);
  });

  it("normalizes media permission failures into backend-safe reason codes", () => {
    assert.equal(
      normalizeMediaFailureReason({ name: "NotAllowedError" }, "caller"),
      "caller_media_permission_denied",
    );
    assert.equal(
      normalizeMediaFailureReason({ name: "NotFoundError" }, "callee", "video"),
      "no_video_input",
    );
    assert.equal(
      normalizeMediaFailureReason({ code: "timeout" }, "callee"),
      "callee_media_permission_timeout",
    );
  });

  it("closes duplicate ringing tabs after another tab resolves the call", () => {
    assert.equal(
      shouldCloseIncomingCall({
        activeCallId: "call-1",
        eventCallId: "call-1",
        currentTabInstanceId: "tab-1",
        answeredByTabInstanceId: "tab-2",
      }),
      true,
    );
    assert.equal(
      shouldCloseIncomingCall({
        activeCallId: "call-1",
        eventCallId: "call-1",
        currentTabInstanceId: "tab-2",
        answeredByTabInstanceId: "tab-2",
      }),
      false,
    );
  });
});
