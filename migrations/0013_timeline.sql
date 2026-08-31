-- Real event date, distinct from created_at (row-insert time). Populated
-- for existing albums from their linked event's starts_at; populated for
-- imported albums from a parsed filename date (see scripts/import-timeline.mjs).
ALTER TABLE albums ADD COLUMN occurred_at TEXT;

-- Backfill existing albums from their linked event (all 5 have one today).
UPDATE albums SET occurred_at = (SELECT starts_at FROM events WHERE events.id = albums.event_id) WHERE event_id IS NOT NULL;

-- SOL Weekend flag: distinguishes the curated annual-gathering albums from
-- the historical personal-archive import (a wedding, a yearbook, a
-- bachelor party aren't "SOL Weekends"). All 5 existing albums are real
-- SOL weekends; the historical import is deliberately never auto-flagged.
ALTER TABLE albums ADD COLUMN is_sol_weekend INTEGER NOT NULL DEFAULT 0;
UPDATE albums SET is_sol_weekend = 1;

CREATE INDEX idx_albums_occurred ON albums(occurred_at);
