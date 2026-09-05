-- readiness_checkins was superseded by daily_checkins before any code ever
-- wrote to it: zero rows, zero references anywhere in the application.
-- daily_checkins is the single canonical readiness table.

drop table if exists public.readiness_checkins;
