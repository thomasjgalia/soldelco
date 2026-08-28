-- Birthday stored as MM-DD only, never a year -- most of the source data
-- (an iOS contacts export) doesn't have a real birth year anyway (iOS's
-- "1604" sentinel means month/day-only was entered), and a public-ish
-- friend-group roster shouldn't broadcast people's exact age even where a
-- real year happens to be known.
ALTER TABLE members ADD COLUMN birthday TEXT;
ALTER TABLE members ADD COLUMN address TEXT;
