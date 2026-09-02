-- Existing projects may grant broad table privileges to service_role by
-- default. Keep operational telemetry append/read-only even for server code.
revoke all on table public.app_observability_events from service_role;
grant select, insert on table public.app_observability_events to service_role;

-- Covers the user foreign key for account deletion and any future support
-- investigation without creating a standalone high-cardinality index.
create index if not exists app_observability_events_user_created_idx
  on public.app_observability_events (user_id, created_at desc);
