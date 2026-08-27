-- Links a cornhole tournament to a SOLDelco event/competition, so results
-- can be synced whenever the link happens to be made -- before, during, or
-- after the tournament is played -- rather than requiring the SOLDelco
-- event to exist up front.
ALTER TABLE cornhole_events ADD COLUMN soldelco_event_id INTEGER REFERENCES events(id);
ALTER TABLE cornhole_events ADD COLUMN soldelco_competition_id INTEGER REFERENCES competitions(id);
