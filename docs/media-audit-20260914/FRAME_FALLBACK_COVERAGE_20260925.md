# GYMS.LIFE legal frame fallback coverage — 2026-09-25

This document extends the zero-budget media audit in draft PR #86. It records a **non-video fallback layer only**. No application source, production asset, database row, runtime media mapping, dependency or deployment is changed by this document.

## Why this layer exists

The preferred hierarchy remains:

1. exact real-human commercial-use video;
2. exact open-license real-human video;
3. exact legal multi-frame/animated fallback;
4. current static illustration only when nothing stronger is safe.

A correct frame sequence is preferable to a wrong exercise video. Frame coverage must never be reported as video coverage.

## Workout Guide source

Repository: `bryllim/workout-guide`.

The package manifest currently contains **302 exercises**. Each exercise has three consistent 512×512 SVG frames. Asset metadata records Bryl Lim as creator and **CC BY-SA 4.0** as the asset license; many original poses cite Everkinetic, also under CC BY-SA, with the transformation described in the manifest.

The software license and the visual-asset license are separate. For GYMS.LIFE, any imported frame would need attribution and share-alike compliance for adaptations.

## Automated GYMS.LIFE cross-check

The live GYMS.LIFE exercise catalogue contains **175 unique slugs**.

Manifest comparison found:

- **94/175** direct same-slug matches before variant filtering.
- Four same-slug records are held back because the equipment/variant differs materially:
  - `chest-supported-row`: GYMS expects dumbbell; Workout Guide entry is machine.
  - `reverse-lunge`: GYMS expects bodyweight; Workout Guide entry uses dumbbells.
  - `t-bar-row`: GYMS catalogue classifies barbell; Workout Guide entry is machine.
  - `wrist-curl`: GYMS expects dumbbell; Workout Guide entry uses barbell.
- After adding only high-confidence naming aliases with compatible equipment, the **conservative Frame-B coverage is 126/175**.
- This number is fallback coverage, not final production approval and not video coverage.

## High-confidence alias matches

| GYMS slug | Workout Guide slug | Equipment |
|---|---|---|
| abductor-machine | hip-abduction-machine | Machine |
| adductor-machine | hip-adduction-machine | Machine |
| band-glute-kickback | banded-kickback | Resistance Band |
| band-hip-thrust | banded-hip-thrust | Resistance Band |
| band-lateral-walk | banded-lateral-walk | Resistance Band |
| band-pulldown | banded-lat-pulldown | Resistance Band |
| band-squat | banded-squat | Resistance Band |
| barbell-shrug | shrug | Barbell |
| captains-chair-raise | captains-chair-knee-raise | Machine |
| cat-cow | cat-cow-stretch | Bodyweight |
| chest-press-machine | machine-chest-press | Machine |
| close-grip-pulldown | close-grip-lat-pulldown | Cable |
| db-bulgarian-split-squat | bulgarian-split-squat | Dumbbell |
| db-fly | dumbbell-fly | Dumbbell |
| db-hip-thrust | dumbbell-hip-thrust | Dumbbell |
| db-incline-press | incline-dumbbell-press | Dumbbell |
| db-romanian-deadlift | dumbbell-romanian-deadlift | Dumbbell |
| db-shrug | dumbbell-shrug | Dumbbell |
| db-sumo-squat | dumbbell-sumo-squat | Dumbbell |
| dumbbell-press | dumbbell-bench-press | Dumbbell |
| farmers-carry | farmer-carry | Dumbbell |
| glute-machine | machine-glute-kickback | Machine |
| hip-flexor-stretch | kneeling-hip-flexor-stretch | Bodyweight |
| hollow-hold | hollow-body-hold | Bodyweight |
| incline-db-curl | incline-dumbbell-curl | Dumbbell |
| one-arm-db-row | one-arm-dumbbell-row | Dumbbell |
| overhead-triceps-extension | dumbbell-overhead-tricep-extension | Dumbbell |
| rope-pushdown | rope-tricep-pushdown | Cable |
| rowing-machine | rowing | Cardio |
| shoulder-press-machine | machine-shoulder-press | Machine |
| ski-erg | skierg | Cardio |
| skullcrusher | skull-crusher | Barbell |
| smith-squat | smith-machine-squat | Machine |
| triceps-pushdown | tricep-pushdown | Cable |
| wide-grip-pulldown | wide-grip-lat-pulldown | Cable |

## Direct high-value Frame-B gaps now covered

The manifest has exact exercise/equipment records for many current real-video gaps, including:

`archer-push-up`, `arnold-press`, `band-pull-apart`, `bear-crawl`, `bird-dog`, `cable-crunch`, `cable-kickback`, `chest-dip`, `close-grip-bench-press`, `concentration-curl`, `cossack-squat`, `dead-bug`, `dead-hang`, `decline-push-up`, `diamond-push-up`, `dragon-flag`, `front-raise`, `frog-pump`, `good-morning`, `inverted-row`, `jump-squat`, `landmine-press`, `machine-row`, `pallof-press`, `pendlay-row`, `pistol-squat`, `plank-shoulder-tap`, `rack-pull`, `single-leg-glute-bridge`, `straight-arm-pulldown`, `sumo-deadlift`, `superman`, `upright-row`, `v-up`, `wall-sit`, `wide-push-up`, and `worlds-greatest-stretch`.

## Remaining 49 without conservative Workout Guide Frame-B mapping

`band-chest-press`, `band-curl`, `band-leg-curl`, `band-triceps-extension`, `barbell-calf-raise`, `barbell-curl`, `barbell-lunge`, `barbell-step-up`, `box-jump`, `box-squat`, `cable-crossover`, `chest-supported-row`, `clean-and-press`, `close-grip-push-up`, `couch-stretch`, `db-calf-raise`, `db-pullover`, `db-shoulder-press`, `db-step-up`, `db-walking-lunge`, `foam-roll-quads`, `handstand-hold`, `kb-clean`, `kb-deadlift`, `kb-front-rack-squat`, `kb-lunge`, `kb-snatch`, `kb-turkish-get-up`, `lunge`, `med-ball-slam`, `med-ball-twist`, `pause-squat`, `reverse-lunge`, `seated-cable-row`, `sit-up`, `sled-push`, `t-bar-row`, `thoracic-rotation`, `thruster`, `toes-to-bar`, `treadmill-sprint`, `tricep-dip`, `triceps-pushdown`, `trx-fallout`, `trx-pistol`, `trx-push-up`, `trx-row`, `wall-ball`, `wrist-curl`, `zercher-squat`.

Many of these already have A/B real-video candidates in the separate video registry; this list is only the subset not covered by this particular frame source.

## Additional legal findings from the 2026-09-25 continuation

- `barbell-calf-raise` has old Everkinetic CC BY-SA 3.0 Commons assets, but they are small/static and therefore only a last-resort illustration fallback.
- `pike-push-up` and `close-grip-push-up` have modern real-human animated GIF fallbacks on Commons under CC BY-SA 4.0.
- `med-ball-slam` has a strong Coverr individual asset, “Throwing a medicine ball on the floor,” marked **Free Commercial Rights**, 24.3 s, 24 fps, 16:9. It remains pending original-file frame QC before A/A-B promotion.
- `workout.cool` is **not** treated as a reusable media source: its code is MIT, but its exercise videos are supplied via partner Fit'Distance and the media rights are not granted downstream by the software license.
- ExerciseDB/open API software licenses are not treated as proof of rights to bundled or CDN-hosted exercise media.
- Programme is excluded because its video terms prohibit compiling the videos to replicate a similar/competing service.
- Uppbeat free/basic licensing is not considered suitable for an organisation/business production use case.
- Vecteezy Free remains excluded as a preferred production source because its free-use restrictions are less suitable for a long-lived commercial app.

## Implementation rule

Do not automatically replace every current frame with Workout Guide. Production implementation should choose the strongest source per slug:

`A video > B video > exact Frame-B > Animated-B > current static fallback`.

Every selected source needs stored provenance, license, author/attribution requirements, source URL, asset checksum and review status. No generated interpolation should be represented as true exercise footage.
