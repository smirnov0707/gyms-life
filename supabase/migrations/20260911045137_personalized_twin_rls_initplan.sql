-- Avoid per-row auth.uid() evaluation in Personalized Twin RLS policies.

alter policy personalized_twin_capture_sets_owner_read
  on public.personalized_twin_capture_sets
  using (user_id = (select auth.uid()));

alter policy personalized_twin_capture_sets_owner_begin
  on public.personalized_twin_capture_sets
  with check (
    user_id = (select auth.uid())
    and status = 'collecting'
    and consent_version = 'personalized_twin_v1'
    and provider_key is null
    and provider_job_id is null
    and model_object_path is null
    and error_code is null
  );

alter policy personalized_twin_capture_sets_owner_delete
  on public.personalized_twin_capture_sets
  using (
    user_id = (select auth.uid())
    and status in ('collecting','ready_for_provider','failed')
  );

alter policy personalized_twin_capture_images_owner_read
  on public.personalized_twin_capture_images
  using (user_id = (select auth.uid()));

alter policy personalized_twin_capture_images_owner_insert
  on public.personalized_twin_capture_images
  with check (
    user_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and split_part(object_path, '/', 2) = capture_set_id::text
    and split_part(object_path, '/', 3) = angle
    and exists (
      select 1
      from public.personalized_twin_capture_sets s
      where s.id = capture_set_id
        and s.user_id = (select auth.uid())
        and s.status = 'collecting'
    )
  );

alter policy personalized_twin_capture_images_owner_delete
  on public.personalized_twin_capture_images
  using (user_id = (select auth.uid()));

alter policy personalized_twin_input_owner_read
  on storage.objects
  using (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy personalized_twin_input_owner_insert
  on storage.objects
  with check (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy personalized_twin_input_owner_delete
  on storage.objects
  using (
    bucket_id = 'personalized-twin-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy personalized_twin_model_owner_read
  on storage.objects
  using (
    bucket_id = 'personalized-twin-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
