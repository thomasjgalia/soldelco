-- One-off import from players-export.csv (SOL Golf app roster).
-- Safe to re-run: matches existing members by display_name and updates names in place.

-- The site's first test member ("Tom") is the same person as playerid 1 below;
-- rename in place so the bulk insert merges into this row instead of duplicating it.
UPDATE members SET display_name = 'Tom Galia', first_name = 'Tom', last_name = 'Galia' WHERE display_name = 'Tom';

INSERT INTO members (display_name, first_name, last_name) VALUES
	('Tom Galia', 'Tom', 'Galia'),
	('Chris Skahan', 'Chris', 'Skahan'),
	('Ted Boyle', 'Ted', 'Boyle'),
	('Joe Sullivan', 'Joe', 'Sullivan'),
	('Bill Sullivan', 'Bill', 'Sullivan'),
	('Brian Burke', 'Brian', 'Burke'),
	('Tom Marturano', 'Tom', 'Marturano'),
	('Andy Coyne', 'Andy', 'Coyne'),
	('Mark Brady', 'Mark', 'Brady'),
	('Jimmy Kearney', 'Jimmy', 'Kearney'),
	('Chris Preston', 'Chris', 'Preston'),
	('Mark Amoroso', 'Mark', 'Amoroso'),
	('Mike Saulino', 'Mike', 'Saulino'),
	('Matt Coyne', 'Matt', 'Coyne'),
	('Mike Torelli', 'Mike', 'Torelli'),
	('Andy Boyle', 'Andy', 'Boyle'),
	('Chris Fanelli', 'Chris', 'Fanelli')
ON CONFLICT (display_name) DO UPDATE SET
	first_name = excluded.first_name,
	last_name = excluded.last_name;
