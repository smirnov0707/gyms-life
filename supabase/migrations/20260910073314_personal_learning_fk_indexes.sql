create index if not exists personal_model_predictions_artifact_owner_idx
  on public.personal_model_predictions(artifact_id,user_id);
create index if not exists personal_model_predictions_decision_owner_idx
  on public.personal_model_predictions(decision_id,user_id);
create index if not exists night_lab_reviews_snapshot_idx
  on public.night_lab_reviews(snapshot_id);
