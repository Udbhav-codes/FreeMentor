-- Device registration tokens for Firebase Cloud Messaging.
--
-- One row per (user, device). A learner with a phone and a tablet has two;
-- reinstalling the app produces a new token and the old one goes stale, which
-- is why `last_seen_at` exists and why delivery failures delete rather than
-- retry — FCM reports an unregistered token and the only correct response is
-- to stop sending to it.
--
-- The token itself is not a secret in the sense a password is: it identifies
-- a device to Google, and holding one lets you send that device a push only
-- if you also hold our Firebase credentials. It is still personal data —
-- it links to one person's device — so it is covered by RLS like every other
-- per-user table, is included in the data export, and goes with the account
-- on deletion.

create table if not exists device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  -- The FCM registration token. Unique across users: the same physical
  -- device signing in as somebody else must move the row, not duplicate it,
  -- or the previous learner keeps receiving that device's notifications.
  token         text not null unique,
  platform      text not null default 'android',
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists idx_device_tokens_user on device_tokens (user_id);

alter table device_tokens enable row level security;

-- Same shape as notification_prefs_self: a learner reaches only their own
-- rows, and cannot insert a row naming somebody else.
create policy device_tokens_self on device_tokens
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

-- The account purge (0004) relies on `on delete cascade` above to take these
-- with the user, so nothing is added there. Unlike purchases, a device token
-- has no retention requirement and must not survive an erasure.
