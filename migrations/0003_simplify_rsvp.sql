-- RSVP forms are now a plain yes/no, not a data-driven field list.
ALTER TABLE rsvp_responses ADD COLUMN attending TEXT;
UPDATE rsvp_responses SET attending = json_extract(response_json, '$.attending');
ALTER TABLE rsvp_responses DROP COLUMN response_json;
ALTER TABLE rsvp_forms DROP COLUMN fields_json;
