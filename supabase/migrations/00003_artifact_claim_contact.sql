-- Store public claim contact details for artifacts claimed without a login.
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS claimed_name text;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS claimed_email text;
