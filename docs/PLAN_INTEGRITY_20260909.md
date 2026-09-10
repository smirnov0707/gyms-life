# Training and nutrition integrity — payments deferred

Base: `97b3947079824350d6399f9fef153b1105d6af79` (PR #58). Branch: `codex/training-nutrition-integrity-20260909`. This continuation follows the user's explicit instruction to leave payment setup for later. No billing source, credentials, prices, provider account settings or billing database migration are changed in this block.

## Recipes, portions and shopping list

New generated recipes pass a stricter contract than old stored plans: explicit nonempty ingredients and instructions, numeric fields that do not convert null/booleans/blank strings into zero, and exact assigned day numbers in each generation part. Day 1–4 is validated before requesting day 5–7. Hydration advice no longer has a fabricated fixed-volume fallback.

Both target and per-meal energy/macronutrient arithmetic are checked. Previously, opposite errors in two meals could cancel in a plausible daily total. Accepted day totals are still reconciled to their meals. This is internal consistency, not a food-composition-database calculation or evidence of clinical suitability. The pre-existing requested-energy bounds are not new medical thresholds.

A shared quantity parser handles explicit grams/kilograms, millilitres/litres, item counts, measuring spoons/cups and common fractions, including decimal commas. Ambiguous ranges, unsupported units and missing main-ingredient amounts are not invented. Raw/dry/cooked descriptors remain in the shopping-list name; dry rice and cooked rice are not collapsed into one entry. Unspecified main ingredients are labelled as unspecified, not automatically 'to taste'. Only explicit to-taste wording or named salt/pepper keeps that presentation.

## Restrictions: positive known conflicts, never a free-from certificate

Generation, adaptation and translated recipe acceptance check for recognized ingredient conflicts with declared restrictions. The bounded dictionary covers common English/Lithuanian names and a few Russian terms. Token matching avoids examples such as eggplant versus egg and nutmeg versus nut. Explicit oat/soy/almond milk does not falsely become dairy, but a separate whey ingredient still matches a milk restriction. A lactose-free descriptor does not waive a milk-allergy conflict.

**The dictionary is incomplete.** It cannot establish absence of allergens, cross-contact, traces, unlisted ingredients, different-language synonyms, or clinical appropriateness. Unknown terms and all free-text medical conditions are not certified. Dislikes and recipe quality still require provider and user review. False positives remain possible; rejection leaves the earlier plan intact rather than silently deleting a recipe or altering its nutrition.

The meal screen shows this limitation with the displayed saved plan and current successfully loaded preferences. A recognized conflict in an older plan is visibly flagged without deleting that plan. No green 'allergy safe' result is inferred from an empty match list. Food-label and cross-contact checks remain essential; official guidance distinguishes vegan labelling from an allergen-free claim:

- https://www.gov.uk/understanding-food-labelling/allergen-labelling
- https://www.gov.uk/government/publications/allergen-guidance-for-food-businesses/allergen-guidance-for-food-businesses

## Translation evidence

Translation must preserve string count, empty strings, numeric token sequences, day/meal ordering, stored macro fields, ingredient quantities and units. Partial chunks no longer silently fall back and enter the cache as a finished translation. Old cached translations are checked before use; a failed translation leaves the original plan available with the existing visible fallback. Numerical preservation does not establish that every translated ingredient is semantically correct; language/provider review remains separate.

## Atomic save and source revisions

The previous sequence independently updated profile preferences, inserted a plan and activated it. A later failure could therefore leave new preferences beside an old plan. `commit_generated_meal_plan` now checks the source profile revision under the existing per-user activation lock and commits all three changes together. A failed insert/activation rolls back preference changes; a changed profile is rejected. The browser receives actual database creation/update timestamps instead of fabricating its own revision.

Only staging (`yywnpovsqifwujuxdxog`) was migrated. Migration `20260909103954_commit_meal_plan_atomically` was followed by `20260909104041_fix_meal_commit_variable_names`: the first real runtime probe found an invalid variable qualification, which was corrected and re-tested, not marked successful. Both migration-history entries are retained. Production has not been migrated.

A rolled-back real PostgreSQL transaction verified a complete save, real timestamps, stale-profile rejection, rollback of preferences after an insertion failure, and replacement with one active plan while retaining the earlier plan. These are storage/ownership assertions against synthetic records, not AI or nutrient correctness. The service result contract also refuses an empty, malformed or mismatched save confirmation. The `meal_plan.activation` observability event remains around the atomic commit.

This change does not provide cross-device request-level generation idempotency or merge concurrent edits. Adaptation retains its existing meal-row revision guard; concurrent profile editing during a separate adaptation request is still a release review case.

## Workout execution

Restoration uses actual completed set numbers and queued records for the already server-confirmed session. An extra set cannot hide a missing planned set, and the same remote/local set is counted once. Filling a gap advances past later sets already recorded. Moving to another exercise retains its known completion state rather than resetting every exercise to set 1. Start/log/finish UI dispatches have one synchronous action guard. The browser test also reproduced a late passive prefill effect clearing newly typed reps after switching exercises; prefill now initializes before paint. The failing runs were retained, and the same journey was re-run without reducing its assertions.

Once a session is started, an unrelated next-workout background read failure or changed day does not hide its immutable execution view or its saved completion summary. Existing server-side set checks, completion criteria and replay-unavailable state are retained.

**Offline scope:** this is not a full account-scoped queue migration. The original device queue and its synchronization protocol remain unchanged. A separate incomplete account-keyed source prototype was moved outside the repository and is not shipped or claimed as fixed. No browser's real queued sets were read, reassigned or deleted. Cross-account/device queue recovery, offline reload without a network session response and multi-client races remain acceptance gates.

## Evidence and release boundary

New deterministic tests cover quantity parsing, internal arithmetic, known restriction examples, translation integrity, atomic save responses and resumed workout gaps. Core browser tests render real app routes using explicit synthetic provider/database responses; they are not live AI calls. Existing authentication, Today, Twin, replay and core tests remain in the per-commit CI gates. Final counts and exact commit belong in the PR verification comment.

No production deployment, main merge, new real AI-provider call, real account write, payment change or medical certification is part of this block. Apply the reviewed meal-save migrations before any future deployment of the new save path. Old plans remain readable and are not deleted merely because they do not meet a new generation contract.

A second rolled-back staging probe used two synthetic accounts. The second account could not read or replace the first account’s plan by reusing its ID; a rejected insert did not change the second account’s profile. The first plan remained active and owned by its original account. Anonymous execution of the new function is revoked.
