# Exercise media: what ships, what reaches anybody, what is recorded

Measured on 2026-10-03 with `npm run inventory:media`. Everything below is a
number that script re-derives; nothing here is an estimate.

## What ships

```
catalogue:           175 exercises
reaches an athlete:  175 frame sets (20.6 MB) + 11 videos (27.5 MB)
cannot be reached:   869 frame sets (93.7 MB)
shipped in total:    2284 files (143.4 MB)
named but absent:    0
never named:         185 files (1.7 MB)
```

## The 869 unreachable frame sets

`getExerciseMedia` lowercases the slug before the lookup:

```ts
const cleanSlug = slug.toLowerCase().trim();
const frames = EXERCISE_DB_FRAMES[cleanSlug];
```

869 of the 1044 frame keys carry an uppercase letter — `3_4_Sit-Up`,
`Ab_Crunch_Machine`, `90_90_Hamstring` — because they are the upstream
`free-exercise-db` folder names, imported wholesale. No slug can ever match
them. This is not unused media; it is unreachable by construction, and the
93.7 MB behind it is uploaded on every deploy and served to nobody.

`exercise-media-inventory.test.ts` pins the contract (every named path exists,
every lowercase key is a catalogue slug, every catalogue slug resolves to
something, and an uppercase key resolves to `fallback`). It deliberately does
not pin the number 869, so cleaning it up does not fail a test.

Two ways out, both product decisions and neither taken here:

1. Delete the 869 entries and the 93.7 MB behind them.
2. Use `public/assets/exercise-db/approved-mapping.json`, which already maps
   catalogue slugs to upstream folder names, so the catalogue can reach them.

## What the repository records about where this came from

Correcting an earlier claim of mine in this session, which was too absolute:
the upstream source _is_ recorded, for part of it.

| File                                                     | Contents                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `public/assets/exercise-db/mapping.json`                 | 34 entries, each naming `"source": "yuhonas/free-exercise-db"` and the upstream folder |
| `public/assets/exercise-db/approved-mapping.json`        | 40 slug → upstream-folder decisions, all `confidence: HIGH`                            |
| `public/assets/exercise-db/high-confidence-mapping.json` | 42 candidate matches                                                                   |
| `public/assets/exercise-db/missing.txt`                  | 140 slugs, `ab-wheel` … `zercher-squat`                                                |

So the images have a named upstream for 34 of the 175. What is still absent
everywhere in the repository is the **licence**: no file names the terms the
`free-exercise-db` images are used under, and nothing at all records where the
11 videos came from. That matters because the site is commercial — Paddle is
wired, and `lg.pricing.feature.library` sells the library beside a price.

The standard of care exists elsewhere and is strict: `media_audit.exercise_media`
in production holds 65 candidate videos with `license_name`, `license_url`,
`attribution_required`, `attribution_text`, `commercial_use_allowed`,
`self_host_allowed` and `share_alike`, and 23 of them are `rejected` precisely
because commercial use and self-hosting were not allowed. All 65 are
`active = false`, so none of them is being served and there is no breach from
that ledger. The media that _is_ being served predates it and never went through
it.

**This is the open question for the owner, and it cannot be answered from the
code:** under what terms are the 143 MB in `public/assets` used, and where did
the 11 videos come from? Inventing an answer would be the same fabrication the
rest of this week's work removed.

## 185 files the map never names

1.7 MB, and two kinds:

- The four sourcing artefacts above. They are working notes, and they are
  publicly fetchable — `https://gyms.life/assets/exercise-db/mapping.json`
  answers. Nothing secret, nothing intended either.
- 16 `pat-*.mp4.asset.json` sidecars whose videos are gone. Each holds an
  `asset_id` and a URL in an external asset store, so they are the only
  remaining pointer to 16 videos that left the repository. Kept for that
  reason; they are not licence records, which is what they look like at a
  glance.
