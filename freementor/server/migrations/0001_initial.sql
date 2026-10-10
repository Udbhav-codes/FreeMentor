-- FreeMentor — initial schema. Product plan §13.
--
-- Mirrors the on-device SQLite tables (app/src/db/schema.ts) so the sync
-- queue can ship rows across with no translation. Where the two differ, the
-- device is the one that has to stay small; this side carries the audit trail.
--
-- Row-level security is on for every table holding learner data (§15). The
-- API uses the user's own JWT, never the service key, so a bug in a handler
-- cannot read another learner's rows — the database refuses.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- people --

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  -- Supabase auth.users.id. The only link between us and the auth system.
  auth_id       uuid not null unique,
  email         text not null,
  name          text,
  photo_url     text,
  birth_year    int,
  gender        text,
  qualification text,
  language      text not null default 'en',
  -- Derived from birth_year at sign-up; drives the ad policy (§10.2).
  is_minor      boolean not null default false,
  created_at    timestamptz not null default now(),
  -- Set on deletion request; purged within 30 days (§15).
  deleted_at    timestamptz,
  constraint users_language_valid check (language in ('en', 'hi', 'hi-en')),
  -- 16+ only (decision #9). Enforced in the app and again here.
  constraint users_age_16_plus check (
    birth_year is null or birth_year <= extract(year from now())::int - 16
  )
);

create index if not exists users_auth_id_idx on users (auth_id);

-- Verifiable parental consent for 16-17s, required before any personal data
-- beyond sign-in is processed (DPDP Rules 2025, §15).
create table if not exists parent_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  parent_contact text not null,
  method         text not null,
  -- Null until the OTP is actually confirmed. A row is not consent.
  consented_at   timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  constraint parent_consents_method_valid check (method in ('email', 'sms'))
);

create index if not exists parent_consents_user_idx on parent_consents (user_id);

-- --------------------------------------------------------------- library --

create table if not exists goals (
  id                text primary key,
  name              text not null,
  category          text not null,
  "group"           text,
  type              text not null,
  status            text not null default 'outline',
  est_hours         int,
  official_url      text,
  eligibility_note  text,
  constraint goals_type_valid check (type in ('exam', 'skill', 'language')),
  constraint goals_status_valid check (status in ('full', 'outline'))
);

create table if not exists library_versions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      text not null references goals (id),
  version      text not null,
  valid_for    text,
  file_url     text not null,
  checksum     text not null,
  published_at timestamptz not null default now(),
  unique (goal_id, version)
);

-- ------------------------------------------------------------- learning --

create table if not exists enrollments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  goal_id            text not null references goals (id),
  library_version_id uuid references library_versions (id),
  start_date         date not null,
  target_date        date,
  status             text not null default 'trial',
  purchase_id        uuid,
  created_at         timestamptz not null default now(),
  constraint enrollments_status_valid check (status in ('trial', 'active', 'archived'))
);

create index if not exists enrollments_user_idx on enrollments (user_id, status);

-- Only one live enrollment per learner (product plan §2: one goal at a time).
-- A goal switch archives the old one, never deletes it (decision #6).
create unique index if not exists enrollments_one_active
  on enrollments (user_id)
  where status <> 'archived';

create table if not exists schedules (
  id                 uuid primary key default gen_random_uuid(),
  enrollment_id      uuid not null references enrollments (id) on delete cascade,
  mode               text not null default 'each_day',
  minutes_by_weekday jsonb not null,
  study_time         text,
  study_place        text,
  language           text not null default 'en',
  selected_subjects  jsonb,
  effective_from     date not null
);

create index if not exists schedules_enrollment_idx on schedules (enrollment_id);

-- block_id holds PlannedItem.key: a library block id for a normal task, or a
-- synthetic key for reviews, warm-ups and weekly tests. Free-form on purpose.
create table if not exists task_progress (
  enrollment_id    uuid not null references enrollments (id) on delete cascade,
  block_id         text not null,
  scheduled_date   date,
  completed_at     date not null,
  minutes_credited int not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (enrollment_id, block_id)
);

create index if not exists task_progress_date_idx
  on task_progress (enrollment_id, completed_at);

create table if not exists confidence_ratings (
  enrollment_id  uuid not null references enrollments (id) on delete cascade,
  topic_id       text not null,
  level          text not null,
  rated_at       date not null,
  next_review_on date,
  updated_at     timestamptz not null default now(),
  primary key (enrollment_id, topic_id),
  constraint confidence_level_valid check (
    level in ('need_revision', 'little_afraid', 'confident', 'all_cleared', 'mastered')
  )
);

create table if not exists test_scores (
  enrollment_id         uuid not null references enrollments (id) on delete cascade,
  block_or_milestone_id text not null,
  score                 numeric not null,
  max_score             numeric not null,
  taken_at              date not null,
  updated_at            timestamptz not null default now(),
  primary key (enrollment_id, block_or_milestone_id),
  constraint test_scores_sane check (max_score > 0 and score >= 0 and score <= max_score)
);

create table if not exists rest_days (
  enrollment_id uuid not null references enrollments (id) on delete cascade,
  date          date not null,
  primary key (enrollment_id, date)
);

create table if not exists streaks (
  user_id         uuid primary key references users (id) on delete cascade,
  current         int not null default 0,
  best            int not null default 0,
  last_study_date date,
  grace_used_on   date
);

-- -------------------------------------------------------------- money ----

create table if not exists coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  discount_tier int not null,
  max_uses      int,
  used_count    int not null default 0,
  valid_from    timestamptz,
  valid_to      timestamptz,
  status        text not null default 'active',
  created_by    uuid,
  created_at    timestamptz not null default now(),
  -- Six uppercase letters then three digits (§10.3).
  constraint coupons_code_format check (code ~ '^[A-Z]{6}[0-9]{3}$'),
  constraint coupons_tier_valid check (discount_tier in (10, 20, 30, 50, 70, 90)),
  constraint coupons_status_valid check (status in ('active', 'archived', 'expired', 'deleted'))
);

create table if not exists purchases (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  enrollment_id   uuid references enrollments (id),
  play_order_id   text unique,
  product_id      text not null,
  plan            text not null,
  coupon_id       uuid references coupons (id),
  price_paid      numeric,
  purchase_state  text not null default 'pending',
  -- Play auto-refunds anything not acknowledged within 3 days (§10.4).
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint purchases_plan_valid check (plan in ('basic', 'premium', 'upgrade'))
);

create index if not exists purchases_user_idx on purchases (user_id);

-- ------------------------------------------------------------ operations --

create table if not exists resources (
  id               uuid primary key default gen_random_uuid(),
  goal_id          text references goals (id),
  url              text not null,
  type             text,
  provider         text,
  lang             text,
  access           text,
  status           text,
  duration_seconds int,
  last_checked     timestamptz
);

create index if not exists resources_checked_idx on resources (last_checked);

create table if not exists link_reports (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid references resources (id) on delete cascade,
  problem     text not null,
  reported_by text not null default 'checker',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists notification_prefs (
  user_id        uuid primary key references users (id) on delete cascade,
  daily          boolean not null default true,
  study          boolean not null default true,
  weekly_report  boolean not null default true,
  streak         boolean not null default true,
  test           boolean not null default true,
  quiet_from     int,
  quiet_to       int
);

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  action     text not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- row-level security

-- Learner-owned tables: a row is visible only to the user it belongs to.
alter table users               enable row level security;
alter table parent_consents     enable row level security;
alter table enrollments         enable row level security;
alter table schedules           enable row level security;
alter table task_progress       enable row level security;
alter table confidence_ratings  enable row level security;
alter table test_scores         enable row level security;
alter table rest_days           enable row level security;
alter table streaks             enable row level security;
alter table purchases           enable row level security;
alter table notification_prefs  enable row level security;

-- The catalog and library are public reads; only the admin service writes.
alter table goals             enable row level security;
alter table library_versions  enable row level security;

-- Back-office tables. RLS on, and deliberately NO policy: that denies every
-- anon and authenticated client outright, while the service key (which
-- bypasses RLS) still works for the server and the admin panel.
--
-- coupons is the one that matters. The publishable key ships inside the app
-- bundle by design, so without this anyone could read every active discount
-- code — including the 90% tier — straight out of the database.
alter table coupons      enable row level security;
alter table resources    enable row level security;
alter table link_reports enable row level security;
alter table audit_log    enable row level security;

create policy users_self on users
  for all using (auth_id = auth.uid()) with check (auth_id = auth.uid());

create policy parent_consents_self on parent_consents
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

create policy enrollments_self on enrollments
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

create policy streaks_self on streaks
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

create policy purchases_self on purchases
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

create policy notification_prefs_self on notification_prefs
  for all using (user_id in (select id from users where auth_id = auth.uid()))
  with check (user_id in (select id from users where auth_id = auth.uid()));

-- Progress tables reach the user through their enrollment.
create policy schedules_own on schedules
  for all using (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  );

create policy task_progress_own on task_progress
  for all using (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  );

create policy confidence_own on confidence_ratings
  for all using (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  );

create policy test_scores_own on test_scores
  for all using (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  );

create policy rest_days_own on rest_days
  for all using (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  ) with check (
    enrollment_id in (
      select e.id from enrollments e
      join users u on u.id = e.user_id
      where u.auth_id = auth.uid()
    )
  );

create policy goals_readable on goals for select using (true);
create policy library_versions_readable on library_versions for select using (true);
