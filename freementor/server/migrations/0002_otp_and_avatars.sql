-- One-time codes for parental consent, and the avatar bucket.
--
-- Codes are stored HASHED. Even in the demo delivery mode there is no column
-- that could hold a usable plaintext code, because that is the column that
-- survives into production.

alter table parent_consents
  add column if not exists code_hash    text,
  add column if not exists expires_at   timestamptz,
  add column if not exists attempts     int not null default 0,
  add column if not exists last_sent_at timestamptz;

-- Finding the live request for a learner.
create index if not exists parent_consents_pending_idx
  on parent_consents (user_id, consented_at);
