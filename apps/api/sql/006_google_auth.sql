-- Google sign-in: link accounts to a Google subject id.
-- Same users table — Google and magic-link converge on email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key
  ON users (google_sub) WHERE google_sub IS NOT NULL;
