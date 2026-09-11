-- Lock Personalized Twin tables down to the minimum client privileges.
-- RLS is the row boundary; table grants remain least-privilege as defense in depth.

revoke all privileges on table public.personalized_twin_capture_sets
  from public, anon, authenticated;
revoke all privileges on table public.personalized_twin_capture_images
  from public, anon, authenticated;

grant select, insert, delete on table public.personalized_twin_capture_sets
  to authenticated;
grant select, insert, delete on table public.personalized_twin_capture_images
  to authenticated;

grant all privileges on table public.personalized_twin_capture_sets
  to service_role;
grant all privileges on table public.personalized_twin_capture_images
  to service_role;
