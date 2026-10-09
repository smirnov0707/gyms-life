# Lab read-state recovery

Base: d825d6853af2a8bb0716b3e0a519a5241be3eef6, after the CI-only audit-integrity merge.

The current journal names unreadable sources only inside its collapsed history, but still prints the empty-history sentence for a failed decision read. A null outcome from an unreadable responses table also appears as 'No response yet', and decision fit can be derived from incomplete decisions/responses.

This increment changes presentation, not the canonical service contracts or calculations. Readable records and known outcomes stay visible. Empty history is only asserted when decisions were readable. Null outcomes from an unreadable response source are labelled unverified. Decision fit counts/rates are withheld when decisions or responses are unreadable; an evidence-only read failure does not hide a rate whose actual inputs were read. No values are written back.

Lab uses the shared SystemNotice surface for initial loading, unavailable reads, partial data, refreshing and failed refreshes. Source names are visible before expanding history. A failed background refresh retains the last loaded snapshot with an explicit warning; it is never labelled freshly verified. There is no fabricated percentage, confidence, telemetry or permanent success badge. Existing reduced-motion/theme behavior is retained. History stays collapsed by default and row status text can wrap at narrow widths.

Retry calls the existing authenticated Lab query with cancelRefetch=false and throwOnError=false; it never offers a manual request to a signed-out visitor. This does not change the pre-existing service's reconciliation work. The existing owner/timezone query key is preserved. No new endpoint, AI request, database migration, dependency, Twin geometry, camera, picking or payment behavior is introduced.

Acceptance includes all eight source-failure combinations, empty and populated history, readable outcomes, insufficient evidence, cached failures, locale fallback, both themes, reduced motion, narrow layouts, actual query retry/de-duplication and account-switch isolation. Browser fixtures use the real component and query hook with synthetic service boundaries. They are not a live account or physical-iPhone test.


## Active route integration

`src/routes/_authenticated/lab.tsx` renders `LabCommandDeck`, not `LabView`.
The first candidate's 45 rendered unit cases and 15 browser groups per engine
covered the legacy overview only. They did not prove the active route had recovery.
This increment corrects that reachability gap rather than replacing the live route
with the old layout.

The live deck and legacy overview now share the authenticated retry/state hook and
copy definitions. The live deck preserves cached data after a failed refresh,
labels partial/stale/refreshing states instead of saying all evidence was loaded,
and exposes the same truthful decision journal in a closed-by-default disclosure.
A failed refresh does not propose a fresh evidence-acquisition action. Independent
experiment and forecast panels retain their own query boundaries.

The browser suite now runs the same 15 groups on each surface in each engine
(30 groups per engine). Real components and query hooks are used; only service
boundaries return synthetic data. This is not live-account, live-DB or physical
mobile-device acceptance. Main, release markers, dependencies and user data are
not changed by preparing this candidate.
