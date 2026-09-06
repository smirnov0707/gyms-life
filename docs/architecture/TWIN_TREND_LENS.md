# Twin Trend Lens

Twin Trend Lens is a descriptive history lens over immutable `athlete_state_snapshots`. It is deliberately separate from Twin Rewind's latest-12 UI window: an active user can create many snapshots in one day, so Trend Lens reads a bounded latest-60 window and returns only a compact browser projection.

## Meaning

The lens does not create intermediate states, backfill missing measurements or ask AI to infer history. Raw `DigitalAthleteState` remains server-side. Only snapshots produced by the currently supported schema and calculation version become trend points; older model versions are counted as incompatible and never reinterpreted.

A series is eligible to display an observed direction only after at least four valid values spanning at least 72 hours. Fewer points or a shorter span remain explicitly insufficient. Even when eligible, `higher`, `lower` and `unchanged` mean only latest stored value compared with earliest stored value. They are not statistical significance, improvement, decline, adaptation, diagnosis or causation.

Missing measurements are omitted from that metric's series rather than converted to zero or another default. The UI line only connects stored observations for readability and explicitly discloses that no intermediate states are created.

## Security and minimization

The server function accepts no user ID. `requireSupabaseAuth` supplies the request-scoped Supabase client and authenticated owner ID. The query adds an explicit `user_id` filter and remains under the existing own-row RLS policy on `athlete_state_snapshots`.

The database query reads the stored state because validation and projection must happen server-side, but the browser receives only timestamps, narrow aggregates and region recovery/volume values. Source windows, provenance summaries, raw context, user IDs and the original state object are not returned.

## Release checks

Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and the Twin browser workflow. A passing synthetic browser regression is not a physical authenticated-device test of the new expanded Trend Lens interaction.
