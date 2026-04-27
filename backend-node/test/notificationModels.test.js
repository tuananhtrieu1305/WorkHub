import test from "node:test";
import assert from "node:assert/strict";

import Notification from "../src/models/Notification.js";
import NotificationSettings from "../src/models/NotificationSettings.js";

const hasIndex = (model, fields, options = {}) => {
  return model.schema.indexes().some(([indexFields, indexOptions]) => {
    const fieldsMatch = JSON.stringify(indexFields) === JSON.stringify(fields);
    const optionsMatch = Object.entries(options).every(
      ([key, value]) => indexOptions[key] === value,
    );
    return fieldsMatch && optionsMatch;
  });
};

test("Notification model defines required fields and indexes", () => {
  assert.ok(Notification.schema.path("userId"));
  assert.ok(Notification.schema.path("type"));
  assert.ok(Notification.schema.path("title"));
  assert.ok(Notification.schema.path("message"));
  assert.ok(Notification.schema.path("entityType"));
  assert.ok(Notification.schema.path("entityId"));
  assert.ok(Notification.schema.path("actorId"));
  assert.ok(Notification.schema.path("data"));
  assert.ok(Notification.schema.path("readAt"));
  assert.ok(Notification.schema.path("deletedAt"));
  assert.ok(Notification.schema.path("createdAt"));

  assert.ok(hasIndex(Notification, { userId: 1, readAt: 1, createdAt: -1 }));
  assert.ok(hasIndex(Notification, { userId: 1, deletedAt: 1, createdAt: -1 }));
  assert.ok(hasIndex(Notification, { entityType: 1, entityId: 1 }));
});

test("NotificationSettings model defines preference fields and unique user index", () => {
  [
    "userId",
    "inAppEnabled",
    "emailEnabled",
    "pushEnabled",
    "taskAssigned",
    "taskUpdated",
    "taskDueSoon",
    "documentShared",
    "documentVersionAdded",
    "adminActions",
    "createdAt",
    "updatedAt",
  ].forEach((field) => assert.ok(NotificationSettings.schema.path(field)));

  assert.ok(hasIndex(NotificationSettings, { userId: 1 }, { unique: true }));
});
