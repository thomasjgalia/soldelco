-- Tables for the cornhole.soldelco.com app (separate Worker, same D1 database).
-- Player identity comes from `members` directly -- no cornhole-specific player table.

CREATE TABLE cornhole_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	date TEXT NOT NULL,
	champion_gets_bye INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cornhole_teams (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	event_id INTEGER NOT NULL REFERENCES cornhole_events(id),
	player1_id INTEGER NOT NULL REFERENCES members(id),
	player2_id INTEGER NOT NULL REFERENCES members(id),
	is_reigning_champion INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cornhole_matches (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	event_id INTEGER NOT NULL REFERENCES cornhole_events(id),
	team1_id INTEGER REFERENCES cornhole_teams(id),
	team2_id INTEGER REFERENCES cornhole_teams(id),
	winner_id INTEGER NOT NULL REFERENCES cornhole_teams(id),
	loser_id INTEGER NOT NULL REFERENCES cornhole_teams(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cornhole_teams_event ON cornhole_teams(event_id);
CREATE INDEX idx_cornhole_matches_event ON cornhole_matches(event_id);
