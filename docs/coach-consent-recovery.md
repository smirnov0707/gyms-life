# Coach privacy preference: unknown is not disabled

Base: released b46f71ee9fcd2ad545dcfdff962f569ec130114c (PR156).

The actual `/coach` route initialized its privacy toggle to false. A failed GET showed a transient error, set loading=false and then displayed the normal disabled-state label with an enabled Enable button. A repeated activation could also append duplicate immutable consent decisions before React committed the saving state. The explanatory privacy copy was exposed only through mouse-hover title attributes.

This increment extracts the card without changing the rest of the Coach conversation. It uses a per-mounted-account, nonpersistent read/write session: loading, signed out, confirmed preference, saving, and unavailable. Read failures are unknown, not false. Writes require an explicit activation from a confirmed state, are synchronously deduplicated, and are not treated as successful before their matching reply. A lost/invalid save reply is ambiguous; only a fresh read is offered, never an automatic replay of the immutable write. Unmount/account-switch generations ignore obsolete replies, including React StrictMode cleanup/restart. Status reasons are visible and logged as fixed codes, without raw errors or account details.

The existing privacy description is visible text in the already collapsed privacy section. Controls use theme tokens, wrapping text, a 44px minimum height and reduced-motion loading. Locale fallback uses baseLang. A different authenticated owner remounts the card; signed-out renders neither an active control nor a request. No server function, consent policy/version, database, RLS, AI payload, dependency, Twin renderer or user records are changed by preparing this patch.

Unit tests cover same-tick races, malformed replies, a lost response after a successful write, read-only recovery, lifecycle/account separation and localized unknown states. Browser acceptance must exercise the actual Coach route using isolated synthetic service boundaries, both engines/themes, and narrow text layouts. These tests do not imply live-account, physical-iPhone or live-database acceptance. Normal CI, both builds and screenshot review remain required before release.

Known separate work: the conversation history request can still race a send, and CoachMemory read failures still need their own recovery treatment. Those are not claimed fixed by this privacy-only increment.
