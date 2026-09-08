# Future Lab reference implementation — application, not an image

The supplied September 8 desktop and six-phone references define the layout.
No new concept image is needed. Continue the actual application in PR #55;
keep the separate V10 human-authoring experiments out of this app change.

## Screen / data / action map

| Screen                                                        | Existing real implementation in the reference UI branch                                                                                                       | Source and limits                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today `/app`                                                  | Five-column cockpit, signals/plan, readiness/brief/decision, interactive Twin, Lab roster, prediction evidence/recovery/sleep, four lower cards, source strip | Existing authenticated reads. Missing values stay missing. Refresh re-reads received records, not a vendor sync.                                                                             |
| My Twin `/twin`                                               | Overview, Muscles, Systems; body composition, region picker, timeline, trend and rewind                                                                       | Canonical Twin snapshot and observations. Search state survives reload/back/forward.                                                                                                         |
| Muscle detail `/twin?view=muscles&region=chest&detail=status` | Status / History / Impact, selected anatomical region, load, recovery estimate, last trained, evidence, training link                                         | Region detail is linked directly from Today. Growth signal, clinical injury risk and future region strength slots explicitly say not modelled/not assessed; logged volume cannot prove them. |
| Future Me `/progress`                                         | Horizon and exercise selection, athlete illustration, current/projected estimated 1RM, change, evidence, recalculation                                        | Existing deterministic 4/12-week model. 180D/1Y unavailable; 4W is not relabelled as exactly 30D. Illustration is not a personalized body prediction.                                        |
| Lab `/lab`                                                    | Ten-domain roster, investigation/evidence and hypothesis retrospectives                                                                                       | Real data availability, not ten fictitious people or continuous live jobs.                                                                                                                   |
| Journal `/history`                                            | Filtered hypotheses, discoveries, active investigations and decisions, training history                                                                       | Stored records only; hypothesis support is not medical certainty.                                                                                                                            |

Top and bottom primary navigation remains Today / My Twin / Lab / Future Me /
Journal. Training and other existing tools remain accessible. Athlete context,
AI orchestration, auth, RLS, programme writes and analytics are not replaced.
The figures printed in the design reference are NOT defaults for a real account.

## This continuation

Adds validated optional Twin URL state and true links from the cockpit into
muscle evidence; all three detail tabs persist. Invalid region/tab inputs are
ignored without inventing data. Keyboard arrows/Home/End work on Twin views.

Adds a real manual refresh action to the source strip, sharing the exact live
signal query used by the rail. Duplicate submissions are locked while pending.
Empty, stale, partial and unreadable sources receive different feedback. A
successful request is not reported as a successful watch sync.

Repairs the old browser fixture's null Lab/forecast answers to valid empty
schemas, rather than treating null as a real empty account. Browser checks wait
for specific resolved empty states; existing tests are not disabled. Adds
interaction coverage for Today-to-muscle navigation, reload/back behavior and
refresh success/empty/error.

## Acceptance boundary

This document is not a claim of 1:1 pixel parity, final visual approval or a
production deployment. CI screenshots render actual route components with
conspicuously synthetic records. The supplied reference has muscle fibre detail
and muscular proportions the current atlas does not yet reproduce exactly.
Predicted muscle gain/fat loss, clinical injury probabilities, long-horizon body
simulations and continuous specialist activity require implemented, validated
models rather than copying their mockup labels and numbers.

Review the new commit's CI/browser evidence and Netlify preview separately from
production. Keep PR #55 draft until remaining visual/integration gates pass.
