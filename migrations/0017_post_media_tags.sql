-- Tags Sons of Liberty members in individual Feed photos/videos, mirroring
-- photo_tags for album photos (migration 0016). Kept as a separate table
-- rather than a shared one since post_media and photos are separate tables
-- with no common id space.
CREATE TABLE post_media_tags (
	media_id INTEGER NOT NULL REFERENCES post_media(id),
	member_id INTEGER NOT NULL REFERENCES members(id),
	PRIMARY KEY (media_id, member_id)
);

CREATE INDEX idx_post_media_tags_member ON post_media_tags(member_id);
