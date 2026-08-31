-- A thumbnail/poster frame for video post_media rows, so a <video> shows a
-- real frame instead of a black box until tapped. Nullable: only videos get
-- one (client-generated at upload time), and generation can fail (e.g. an
-- unsupported codec for canvas capture) without blocking the upload.
ALTER TABLE post_media ADD COLUMN poster_key TEXT;
