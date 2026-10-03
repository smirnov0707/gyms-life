-- Erasure has to be complete, and one table was not wired to make it so.
--
-- 38 user-owned tables carry `user_id references auth.users(id) on delete
-- cascade`, so deleting the account deletes what it owns and the database — not
-- a hand-written list that can miss a table — decides what that means.
-- `hydration_logs` was the exception: a `user_id` with no foreign key at all.
-- Deleting the account would have left its rows behind, keyed to a person who
-- no longer exists, which is the one thing an erasure request must not do.
--
-- Safe to add as-is: the table holds 0 rows and 0 of them are orphaned, so the
-- constraint cannot fail on existing data. Reversible with
-- `alter table public.hydration_logs drop constraint hydration_logs_user_id_fkey`.

alter table public.hydration_logs
  add constraint hydration_logs_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
