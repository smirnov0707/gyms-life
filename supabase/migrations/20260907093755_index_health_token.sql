-- `profiles.health_token` is the only credential an unauthenticated request
-- can present. `/api/public/health-ingest` looks a profile up by it on every
-- POST, and the column had neither an index nor a uniqueness constraint.
--
-- Two consequences, one of them reachable by anyone who knows the URL:
--
--   * Every request — including every request with a wrong token — made
--     Postgres scan the whole profiles table. An unauthenticated endpoint
--     that costs a full table scan per call is an amplifier: the work grows
--     with the number of athletes, and nothing throttles the caller.
--
--   * Nothing stopped two profiles from holding the same token. The handler
--     reads with `.maybeSingle()`, so a duplicate would not silently ingest
--     one athlete's samples into another's account — it would fail the read
--     and return 503 to both. Unlikely with a v4 uuid, but the constraint
--     costs nothing and turns "unlikely" into "cannot".
--
-- Partial, because a profile that has never asked for a key has a null token
-- and several such rows must be allowed to coexist.
create unique index if not exists profiles_health_token_unique
  on public.profiles (health_token)
  where health_token is not null;

comment on index public.profiles_health_token_unique is
  'Lookup path for /api/public/health-ingest. Unique so one token can never address two athletes; partial so profiles without a key are unaffected.';
