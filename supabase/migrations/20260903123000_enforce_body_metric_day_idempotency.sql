-- One daily body metric record is the canonical input for progress charts,
-- body scans, and the digital athlete model. The unique index makes writes
-- from those independent flows safely idempotent.
create unique index if not exists body_metrics_one_per_user_day_idx
  on public.body_metrics (user_id, measured_on);
