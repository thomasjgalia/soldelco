-- Explicit member tagging on a post (picked from a list at compose time,
-- not free-text @mention parsing -- avoids ambiguous name matches and
-- makes "who got tagged" a real, queryable fact).
CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  PRIMARY KEY (post_id, member_id)
);

CREATE INDEX idx_post_tags_member ON post_tags(member_id);
