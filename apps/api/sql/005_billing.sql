-- Accounts, sessions, and Stripe billing (docs/SUBSCRIPTIONS.md)

CREATE TABLE IF NOT EXISTS users (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email                 text NOT NULL UNIQUE,
  display_name          text,
  tier                  text NOT NULL DEFAULT 'free',   -- free | standard | premium | elite
  stripe_customer_id    text UNIQUE,
  subscription_status   text,                            -- active | trialing | past_due | canceled | comp | …
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_tokens (
  token       text PRIMARY KEY,
  email       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Webhook idempotency ledger.
CREATE TABLE IF NOT EXISTS billing_events (
  event_id   text PRIMARY KEY,
  type       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Invitation codes gate elite checkout (and elite shelf discovery links).
CREATE TABLE IF NOT EXISTS invitations (
  code        text PRIMARY KEY,
  tier        text NOT NULL,
  expires_at  timestamptz,
  max_uses    integer NOT NULL DEFAULT 1,
  use_count   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
