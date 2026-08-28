-- One row per installed device (a member can have several: phone + laptop).
-- endpoint is the browser-assigned push URL and is unique per device/browser
-- install, so it doubles as the natural dedupe key for re-subscribing.
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_push_subscriptions_member ON push_subscriptions(member_id);
