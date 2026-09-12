-- Personalized Twin capture foundation.
-- Photos are opt-in and private. The browser may upload only under its own UID;
-- generated model assets are writable only by trusted server/service-role code.

create table public.personalized_twin_capture_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'collecting'
    check (status in ('collecting','ready_for_provider','processing','ready','failed')),
  consent_version text not null
    check (consent_version = 'personalized_twin_v1'),
  consented_at timestamptz not null,
  provider_key text,
  provider_job_id text,
  model_object_path text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint personalized_twin_ready_requires_model
    check ((status = 'ready' and model_object_path is not null)
      or (status <> 'ready' and model_object_path is null))
);

create table public.personalized_twin_capture_images (
  id uuid primary key default gen_random_uuid(),
  capture_set_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  angle text not null check (angle in ('front','side','back')),
  object_path text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 8388608),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (capture_set_id, angle),
  foreign key (capture_set_id, user_id)
    references public.personalized_twin_capture_sets(id, user_id)
    on delete cascade
);

create index personalized_twin_capture_sets_user_recent_idx
  on public.personalized_twin_capture_sets(user_id, created_at desc, id desc);
create index personalized_twin_capture_images_owner_recent_idx
  on public.personalized_twin_capture_images(user_id, created_at desc, id desc);
create index personalized_twin_capture_images_set_owner_idx
  on public.personalized_twin_capture_images(capture_set_id, user_id);

alter table public.personalized_twin_capture_sets enable row level security;
alter table public.personalized_twin_capture_images enable row level security;

create policy personalized_twin_capture_sets_owner_read
  on public.personalized_twin_capture_sets
  for select to authenticated
  using (user_id = auth.uid());

create policy personalized_twin_capture_sets_owner_begin
  on public.personalized_twin_capture_sets
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'collecting'
    and consent_version = 'personalized_twin_v1'
    and provider_key is null
    and provider_job_id is null
    and model_object_path is null
    and error_code is null
  );

create policy personalized_twin_capture_sets_owner_delete
  on public.personalized_twin_capture_sets
  for delete to authenticated
  using (user_id = auth.uid() and status in ('collecting','ready_for_provider','failed'));

create policy personalized_twin_capture_images_owner_read
  on public.personalized_twin_capture_images
  for select to authenticated
  using (user_id = auth.uid());

create policy personalized_twin_capture_images_owner_insert
  on public.personalized_twin_capture_images
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and split_part(object_path, '/', 1) = auth.uid()::text
    and split_part(object_path, '/', 2) = capture_set_id::text
    and split_part(object_path, '/', 3) = angle
    and exists (
      select 1
      from public.personalized_twin_capture_sets s
      where s.id = capture_set_id
        and s.user_id = auth.uid()
        and s.status = 'collecting'
    )
  );

create policy personalized_twin_capture_images_owner_delete
  on public.personalized_twin_capture_images
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.personalized_twin_capture_sets from anon;
revoke all on public.personalized_twin_capture_images from anon;
grant select, insert, delete on public.personalized_twin_capture_sets to authenticated;
grant select, insert, delete on public.personalized_twin_capture_images to authenticated;
grant all on public.personalized_twin_capture_sets to service_role;
grant all on public.personalized_twin_capture_images to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personalized-twin-private',
  'personalized-twin-private',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personalized-twin-models',
  'personalized-twin-models',
  false,
  16777216,
  array['model/gltf-binary','application/octet-stream']::text[]
)
on conflict (id) do nothing;

create policy personalized_twin_input_owner_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy personalized_twin_input_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy personalized_twin_input_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy personalized_twin_model_owner_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'personalized-twin-models'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.personalized_twin_capture_sets is
  'Opt-in Personalized Twin reconstruction jobs. Client mutation is intentionally limited; provider/status fields are server-owned.';
comment on table public.personalized_twin_capture_images is
  'Private photo metadata for front/side/back Personalized Twin capture. Raw image bytes live in private Storage.';
