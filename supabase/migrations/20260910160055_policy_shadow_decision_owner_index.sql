create index if not exists policy_shadow_records_decision_owner_idx
  on public.policy_shadow_records (decision_id, user_id);
