-- Merge RSVP into competitions ("Activities" in the UI): every activity can
-- carry RSVP responses directly, replacing the standalone rsvp_forms table.
-- kind is reframed as scoring shape (score = numeric, lower wins; placement
-- = manually assigned final standing; rsvp_only = no scoring at all) rather
-- than a fixed game list, so a brand new activity type (e.g. axe throwing)
-- reuses 'placement' or 'score' without a schema change -- only its title
-- differs. attending gains a third state: yes / no / maybe.

-- Existing Fall 2026 competitions/RSVP data is test data (confirmed with Tom) -- reset it.
DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams);
DELETE FROM rsvp_responses;
DELETE FROM teams;
DELETE FROM competitions;
DELETE FROM rsvp_forms;

CREATE TABLE competitions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  kind TEXT NOT NULL CHECK (kind IN ('score', 'placement', 'rsvp_only')),
  title TEXT NOT NULL,
  played_on TEXT,
  rsvp_closes_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO competitions_new (id, event_id, kind, title, played_on, created_at)
  SELECT id, event_id, kind, title, played_on, created_at FROM competitions;
DROP TABLE competitions;
ALTER TABLE competitions_new RENAME TO competitions;
CREATE INDEX idx_competitions_event ON competitions(event_id);

CREATE TABLE rsvp_responses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  attending TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (competition_id, member_id)
);
DROP TABLE rsvp_responses;
ALTER TABLE rsvp_responses_new RENAME TO rsvp_responses;

DROP TABLE rsvp_forms;
