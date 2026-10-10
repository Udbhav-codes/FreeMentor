-- Profile photos.
--
-- PRIVATE, unlike the library bucket. A photo is personal data under §15, so
-- it is reachable only through a signed URL the server issues — never by
-- guessing a path.
--
-- Each learner may only touch objects under their own user id. The policies
-- below enforce that in storage itself, so a bug in an API handler cannot
-- let one learner overwrite another's photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars read own" on storage.objects;
drop policy if exists "avatars write own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;

-- Objects are stored as avatars/<auth uid>/<file>, so the first path segment
-- is the owner.
create policy "avatars read own" on storage.objects
  for select using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars write own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
