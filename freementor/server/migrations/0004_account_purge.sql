-- Purging deleted accounts — §15 and the Privacy Policy's 30-day promise.
--
-- The policy says two things that pull against each other:
--
--   * everything identifying you is erased within 30 days;
--   * the purchase record is kept for 8 years, because Indian tax law
--     requires it.
--
-- `delete from users` cannot satisfy both: purchases.user_id is
-- `on delete cascade`, so deleting the row would take the tax records with
-- it. That is a real bug in the deletion design, not a quirk of doing this in
-- SQL — the API's DELETE /account/me sets deleted_at and has always relied on
-- a purge that did not exist yet.
--
-- So the purge ANONYMISES the users row in place and deletes everything
-- hanging off it. The row survives as an identifier-free stub purely so the
-- purchase keeps a valid foreign key. What remains cannot identify anybody:
-- an id, the dates, and a flag.

-- ---------------------------------------------------------------- the work --

create or replace function purge_deleted_accounts(grace_days int default 30)
returns table (purged int) as $$
declare
  cutoff timestamptz := now() - make_interval(days => grace_days);
  victims uuid[];
begin
  select coalesce(array_agg(id), '{}') into victims
  from users
  where deleted_at is not null
    and deleted_at < cutoff
    -- Already anonymised by a previous run.
    and email <> '';

  if array_length(victims, 1) is null then
    return query select 0;
    return;
  end if;

  -- Detach the purchase from the enrollment FIRST. purchases.enrollment_id
  -- references enrollments with no cascade, so deleting the enrollment is
  -- blocked by the very purchase we are preserving. The link is personal
  -- context we are erasing anyway; the purchase keeps its order id, amount
  -- and plan, which is all the tax record needs.
  update purchases set enrollment_id = null where user_id = any(victims);

  -- Everything that is only ever about this learner. enrollments cascades
  -- onward to schedules, task_progress, confidence_ratings, test_scores and
  -- rest_days, so one delete clears the study history.
  delete from enrollments        where user_id = any(victims);
  delete from parent_consents    where user_id = any(victims);
  delete from streaks            where user_id = any(victims);
  delete from notification_prefs where user_id = any(victims);

  -- purchases are deliberately NOT touched. They are detached from the person
  -- by the anonymisation below, which is what the policy promises: the record
  -- of the transaction survives, the person does not.
  update users
  set
    -- '' rather than null: the column is NOT NULL, and an empty string also
    -- makes the "already purged" test above cheap and obvious.
    email         = '',
    name          = null,
    photo_url     = null,
    birth_year    = null,
    gender        = null,
    qualification = null,
    -- auth_id must stay unique and non-null; a fresh random uuid severs the
    -- link to Supabase auth without colliding with anybody.
    auth_id       = gen_random_uuid()
  where id = any(victims);

  return query select array_length(victims, 1);
end;
$$ language plpgsql security definer;

comment on function purge_deleted_accounts is
  'Erases personal data from accounts deleted more than grace_days ago, '
  'keeping purchase records as tax law requires. Idempotent.';

-- ------------------------------------------------------------- scheduling --
--
-- pg_cron is available on Supabase but not enabled by default. If the
-- extension cannot be created (a plan that does not offer it, or insufficient
-- privileges), this block leaves the function in place and the job unscheduled
-- rather than failing the migration — the function can then be called from
-- anywhere, including a one-line cron elsewhere.

do $$
begin
  create extension if not exists pg_cron;

  -- Daily at 03:15 UTC (08:45 IST), a quiet hour for an Indian audience.
  perform cron.schedule(
    'purge-deleted-accounts',
    '15 3 * * *',
    $job$ select purge_deleted_accounts(30); $job$
  );
  raise notice 'pg_cron scheduled: purge-deleted-accounts runs daily at 03:15 UTC';
exception
  when others then
    raise notice
      'pg_cron unavailable (%). The function exists; schedule it elsewhere: '
      'select purge_deleted_accounts(30);', sqlerrm;
end;
$$;
