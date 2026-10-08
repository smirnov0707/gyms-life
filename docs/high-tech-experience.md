# GYMS.LIFE — high-tech experience standard

User direction: a world-class, high-tech system, with the clarity and precision they associate with SpaceX and Tesla. This is a quality reference, not an affiliation or a request to copy branding.

## One coherent system

Preserve TODAY / MY TWIN / LAB / COACH. Do not add another top-level product or dashboard. TODAY communicates one decision and primary action. MY TWIN connects evidence to the body. LAB reveals complexity on demand. COACH is the conversational control surface.

## Visual and interaction rules

- Use the existing dark/light theme and typography tokens, restrained graphite surfaces, readable text and tabular numbers. The generic 3D Twin stays naturally skin-toned; personal textures are not repainted.
- One filled primary action per task. Selection is not another primary action: environment toggles use outlined, pressed states.
- A system state must identify what happened and what the user can do. Separate saved, awaiting confirmation, unavailable, linked and not applicable. Never label a local hint as freshly verified server evidence.
- No fake live dots, simulated processing counters, invented confidence, decorative health readings, neon overload or perpetual animations. Subtle transitions follow actual state changes and respect reduced motion.
- Keep touch targets at least 44 CSS pixels, persistent field labels, keyboard focus, narrow-screen wrapping and equivalent light-theme readability.
- Components must share primitives instead of developing different visual dialects. SystemNotice is an initial shared operational surface, currently applied to the run console. This is not yet an entire-app redesign.

## This increment: run continuity

After an acknowledged run needs a plan check or user confirmation, retain only an owner-scoped list of saved session references. No distance, effort, health values, race classification or consent is stored in that list. Returning to the screen or reloading the same tab surfaces the references but performs no automatic network action. Explicit recheck uses the existing authenticated service, which rereads the saved workout. An earlier match suggestion is never restored as fresh evidence or automatically accepted.

Multiple unresolved runs are retained independently. A verified terminal result or explicit rejection clears only that run's hint. Storage failures are visibly separate from workout persistence; corrupt hints are not overwritten and a full queue never silently evicts another run. The queue is limited to 64 references. The guarantee covers surviving same-tab session storage, not closing the tab, another device, deletion/eviction or a global retry ledger. The server remains the source of truth. No schema, privileges, AI providers or physiological calculations change.

## Acceptance boundary

Automated tests must use the real run component, both pinned browser engines, dark/light narrow layouts, remount/reload, multiple runs, explicit consent, failed storage and foreign/corrupt receipts. Full CI, Core and Today regressions remain release gates. Synthetic browser/service tests are not physical-device or live-database acceptance.
