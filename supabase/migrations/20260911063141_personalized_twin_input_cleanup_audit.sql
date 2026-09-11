alter table public.personalized_twin_capture_sets
  add column input_deleted_at timestamptz;

alter table public.personalized_twin_capture_sets
  add constraint personalized_twin_terminal_requires_input_cleanup
  check (
    status not in ('ready','failed')
    or input_deleted_at is not null
  );

comment on column public.personalized_twin_capture_sets.input_deleted_at is
  'Set by trusted server code only after all raw Personalized Twin input media for the capture set has been deleted from private Storage. Terminal ready/failed states require this audit marker.';
