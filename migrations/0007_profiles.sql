-- Member profiles: a photo, contact info, and an optional passcode that
-- gates editing your own profile (not claiming an identity at /whoami,
-- which stays as open as it's always been).
ALTER TABLE members ADD COLUMN avatar_key TEXT;
ALTER TABLE members ADD COLUMN email TEXT;
ALTER TABLE members ADD COLUMN phone TEXT;
ALTER TABLE members ADD COLUMN passcode TEXT;
