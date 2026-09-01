create table public.ai_personalization_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted boolean not null,
  policy_version text not null check (char_length(trim(policy_version)) between 1 and 64),
  recorded_at timestamptz not null default now()
);

create index ai_personalization_consents_user_recorded_idx
  on public.ai_personalization_consents (user_id, recorded_at desc, id desc);

alter table public.ai_personalization_consents enable row level security;

revoke all on table public.ai_personalization_consents from anon;
revoke all on table public.ai_personalization_consents from authenticated;
grant select on table public.ai_personalization_consents to authenticated;
grant insert (user_id, granted, policy_version) on table public.ai_personalization_consents to authenticated;
grant usage on sequence public.ai_personalization_consents_id_seq to authenticated;
grant all on table public.ai_personalization_consents to service_role;
grant usage, select on sequence public.ai_personalization_consents_id_seq to service_role;

create policy "Users read own AI personalization consent history"
on public.ai_personalization_consents
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users record own AI personalization consent"
on public.ai_personalization_consents
for insert to authenticated
with check ((select auth.uid()) = user_id);
