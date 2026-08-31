-- Tags Sons of Liberty members in album photos, mirroring post_tags for
-- Feed posts (migration 0011). Composite PK doubles as the uniqueness
-- constraint (a member can't be tagged twice in the same photo).
CREATE TABLE photo_tags (
	photo_id INTEGER NOT NULL REFERENCES photos(id),
	member_id INTEGER NOT NULL REFERENCES members(id),
	PRIMARY KEY (photo_id, member_id)
);

CREATE INDEX idx_photo_tags_member ON photo_tags(member_id);
