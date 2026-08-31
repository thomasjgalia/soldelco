-- A thumbnail/poster frame for album video photos, mirroring
-- post_media.poster_key (migration 0012). Nullable: only videos get one,
-- generated client-side at upload time (or via the one-time admin backfill
-- tool for videos that predate this).
ALTER TABLE photos ADD COLUMN poster_key TEXT;
