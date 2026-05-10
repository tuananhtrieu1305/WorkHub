import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isImmersiveRoomRoute, shouldShowRightSidebar } from "./layoutState.js";

describe("layout route helpers", () => {
  it("treats call and meeting room routes as immersive", () => {
    assert.equal(isImmersiveRoomRoute("/calls/call-1"), true);
    assert.equal(isImmersiveRoomRoute("/meetings/meeting-1"), true);
    assert.equal(isImmersiveRoomRoute("/meetings"), false);
  });

  it("hides the right sidebar for chat and room routes", () => {
    assert.equal(shouldShowRightSidebar("/messages"), false);
    assert.equal(shouldShowRightSidebar("/messages/abc"), false);
    assert.equal(shouldShowRightSidebar("/meetings/abc"), false);
    assert.equal(shouldShowRightSidebar("/calls/abc"), false);
    assert.equal(shouldShowRightSidebar("/meetings"), true);
    assert.equal(shouldShowRightSidebar("/"), true);
  });
});
