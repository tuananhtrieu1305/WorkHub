import assert from "node:assert/strict";
import test from "node:test";

import { getLocalDateKey } from "../src/utils/dateKeys.js";

test("getLocalDateKey keeps the local calendar day for local midnight", () => {
  const localMidnight = new Date(2026, 5, 17, 0, 0, 0);

  assert.equal(getLocalDateKey(localMidnight), "2026-06-17");
  if (localMidnight.toISOString().slice(0, 10) !== "2026-06-17") {
    assert.notEqual(
      getLocalDateKey(localMidnight),
      localMidnight.toISOString().slice(0, 10),
    );
  }
});
