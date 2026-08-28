-- The social feed: free-form posts (text/link/photos/videos), with replies
-- and reactions reusing the existing polymorphic comments/reactions tables
-- (target_type='post') rather than building parallel post_comments /
-- post_reactions tables.

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id),
  body TEXT,
  link_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_posts_created ON posts(created_at);
CREATE INDEX idx_post_media_post ON post_media(post_id);

-- Rebuild to widen the target_type CHECK to include 'post' (SQLite can't
-- ALTER a CHECK constraint in place). Both tables are empty in production
-- (never wired into any UI yet), so this is a plain schema swap, no data to
-- migrate.
CREATE TABLE comments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('album', 'photo', 'event', 'post')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO comments_new SELECT * FROM comments;
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;
CREATE INDEX idx_comments_target ON comments(target_type, target_id);

CREATE TABLE reactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('album', 'photo', 'event', 'post')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL DEFAULT 'heart',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (target_type, target_id, member_id)
);
INSERT INTO reactions_new SELECT * FROM reactions;
DROP TABLE reactions;
ALTER TABLE reactions_new RENAME TO reactions;
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
