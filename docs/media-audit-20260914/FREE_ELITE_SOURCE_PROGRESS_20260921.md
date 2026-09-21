# GYMS.LIFE free elite video sourcing progress — 2026-09-21

This document extends the zero-budget media audit in PR #86. It is research/audit data only. No application media, runtime mapping, database row or production deployment is changed here.

## Selection standard

Preferred order: exact real-human commercial-use stock -> exact open-license real-human fallback -> current static illustration. Do not map a visually similar but different exercise merely to increase coverage.

An A candidate should have a clear exercise match, matching equipment/variant, commercially usable terms and acceptable production presentation. B candidates are technically useful exact/near-exact fallbacks with weaker framing, older visual style, attribution/share-alike requirements, portrait format, or a specific variant that needs UI disclosure/QC.

## Preferred sources

- Mixkit Stock Video Free License: strongest source for several premium gym/machine clips; every asset must be checked for Free vs Restricted License.
- Pexels: strongest broad real-human source; exact asset pages are required because search tags are noisy.
- Coverr: useful commercial-use source when the individual clip is clearly human-shot; collection pages can mix human and AI content.
- YMove Free: 25 official free clips, 720x1280, commercial app/site use, small visible Your Move watermark.
- Wger: 78 current videos across 46 exercises; all checked API entries were CC BY-SA 4.0 by Goulart. Strong legal/exact fallback, weaker visual consistency.
- Wikimedia Commons: useful exact CC clips, but each file's license/review state must be checked individually.

## Recently verified exact additions

| GYMS slug | Tier | Source | Candidate / result |
|---|---|---|---|
| lunge | A | Mixkit Free | Clip 52112; downloaded 1280x720 and contact-sheet reviewed. Demonstrator travels forward through repeated bodyweight walking lunges. |
| cable-crossover | A | Mixkit Free | 100547; downloaded 1280x720 preview and contact-sheet reviewed. Clear two-cable crossover in a dark premium gym. |
| bodyweight-squat | A | Mixkit Free | 44438; downloaded and reviewed. Repeated unweighted squats. |
| barbell-row | B | Wikimedia / FitnessScape / CC BY 3.0 | Bent-over row demonstration, 1280x720; downloaded and reviewed. Correct hip hinge and barbell row, but older style and embedded exercise label. |
| burpee | B | Wikimedia / CC BY-SA 3.0 | Burpee How To, 1280x720; downloaded and reviewed. Complete basic burpee sequence, older outdoor presentation. |
| cable-lateral-raise | B | Wger / CC BY-SA 4.0 | 1080p single-arm cable lateral raise; downloaded and reviewed. |
| kb-snatch | B | Wikimedia / CC BY-SA 4.0 | Kettlebell Full Snatch; real-human but 640x480 / older outdoor presentation. |
| kb-front-rack-squat | B | Wikimedia / CC BY-SA 4.0 | Racked kettlebell squat; real-human but 640x480 / older presentation. |
| kb-turkish-get-up | B | Wikimedia / CC BY-SA 4.0 | Turkish Getup Lunge Style; specific TGU variant, real-human but 640x480. |
| med-ball-slam | A/B pending file QC | Coverr | "Throwing a medicine ball on the floor"; 24.3 s, 24 fps, 16:9, Free Commercial Rights. Description is an exact floor throw/slam, but original-file frame QC is still pending. |

## Important rejects / non-mappings

- Mixkit 52101 is not mapped to walking lunge: the clip mixes a lunge with another floor movement.
- Generic Mixkit 100540 is not yet mapped to machine-row: rear view is too tight to verify the exact handle/path variant.
- Wger Shoulder Shrug is not mapped to barbell-shrug or db-shrug because the checked clip does not show the required equipment.
- Wger One Arm Triceps Extensions on Cable is an overhead cable extension, not a cable kickback.
- Kettlebell Farmer Walks is not mapped to GYMS farmers-carry because the catalogue specifies dumbbells.
- Kettlebell clean/deadlift/lunge combo clips are not split merely to inflate coverage.
- Vecteezy Free is not a preferred production source because its free-use conditions are less suitable for a long-lived commercial product.
- YouTube/Vimeo demonstration availability alone is not evidence of commercial self-host rights.

## Remaining priority gaps

Prioritize exact real-human searches for: arnold-press, chest-supported-row, close-grip-bench-press, landmine-press, farmers-carry (dumbbell), pallof-press, med-ball-slam final QC, cable-crunch, cable-kickback, straight-arm-pulldown, machine-row, t-bar-row, upright-row, wall-sit, plank-shoulder-tap, pike-push-up, bird-dog, dead-bug, single-leg-glute-bridge, TRX variants and remaining band variants.

## Current decision rule

Do not chase 175/175 video coverage at the expense of correctness or rights. A correct static illustration is preferable to a wrong movement video. Import should begin with the strongest A-tier exact matches first, with license metadata stored alongside every selected asset.
