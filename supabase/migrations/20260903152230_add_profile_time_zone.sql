-- A calendar day is user-local in GYMS.LIFE. Persist the validated IANA zone
-- on the canonical profile so server-side decisions and AI context construction
-- do not silently fall back to the deployment server's day boundary.
alter table public.profiles
  add column if not exists time_zone text not null default 'UTC';

comment on column public.profiles.time_zone is
  'Validated IANA time zone used for user-local calendar-day boundaries. Server code falls back to UTC only for invalid legacy values.';
