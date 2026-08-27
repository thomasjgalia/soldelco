-- Core identity
CREATE TABLE members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Weekends / gatherings
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Photo albums
CREATE TABLE albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  event_id INTEGER REFERENCES events(id),
  cover_photo_id INTEGER,
  created_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES albums(id),
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  width INTEGER,
  height INTEGER,
  taken_at TEXT,
  caption TEXT,
  uploaded_by INTEGER REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_photos_album ON photos(album_id);
CREATE INDEX idx_albums_event ON albums(event_id);

-- Data-driven RSVP forms
CREATE TABLE rsvp_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  title TEXT NOT NULL,
  fields_json TEXT NOT NULL, -- JSON array of {key, label, type, options?}
  closes_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rsvp_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES rsvp_forms(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (form_id, member_id)
);

CREATE INDEX idx_rsvp_forms_event ON rsvp_forms(event_id);

-- Competitions & results (Friday cornhole, Saturday golf scramble)
CREATE TABLE competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  kind TEXT NOT NULL CHECK (kind IN ('golf_scramble', 'cornhole')),
  title TEXT NOT NULL,
  played_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  name TEXT NOT NULL,
  score INTEGER, -- golf scramble: one final score
  placement INTEGER, -- cornhole: final standing (1st, 2nd, ...)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  PRIMARY KEY (team_id, member_id)
);

CREATE INDEX idx_teams_competition ON teams(competition_id);
CREATE INDEX idx_competitions_event ON competitions(event_id);

-- Social: comments + reactions on albums, photos, or events
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('album', 'photo', 'event')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('album', 'photo', 'event')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL DEFAULT 'heart',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (target_type, target_id, member_id)
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
