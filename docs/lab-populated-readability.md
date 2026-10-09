# Populated Lab readability

Base: released 84d33461f5019fd9f41aa8aa0a085d0bcb43019a.

PR155 verified decision-history recovery, but its visual fixtures had empty hypotheses and its small muted metadata remained a readability follow-up. This increment raises evidence/source and decision metadata text sizes, preserves natural wrapping and theme tokens, and gives the active Lab heading, state label and disclosure rows a scoped readable floor. It adds no global stylesheet overrides, new menus or decorative animation. Hypothesis values, classifications, decision authority and recovery logic are unchanged.

The existing 30 browser groups per engine remain required. The additional 60 groups per engine populate all four canonical hypothesis states at 320/390/1280px in LT/EN and both themes, plus eight root-font-doubled cases and four DE-to-EN fallback cases. Real evidence disclosures are opened with a keyboard; rendered text sizes, sampled contrast against the three theme grounds, wrapping, row overlap and retained values during failed refresh/retry are checked. The fixture now has a real memory-router context so an insufficient-evidence action is not falsely tested outside its routing provider.

All fixture measurements are synthetic and all external/write requests are forbidden. The root-font test is not full browser zoom, device text scaling or a physical-iPhone test. Sampled contrast is not complete accessibility certification. Every screenshot must still be visually reviewed before claiming design acceptance. No tests are claimed passed at candidate creation.

No dependency update, schema/RLS/DB migration, user-data operation, AI provider, Twin renderer/camera or payment changes are included. Existing dependency findings and lint warnings are not fixed by this work.
