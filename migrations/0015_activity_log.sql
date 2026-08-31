-- Admin-facing activity feed. Generic event_type + free-text detail rather
-- than one table per event kind, since the set of tracked events is
-- expected to grow and every event so far is "who did what, when" with no
-- need to query/aggregate on event-specific fields.
CREATE TABLE activity_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	event_type TEXT NOT NULL,
	member_id INTEGER REFERENCES members(id),
	detail TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at);
