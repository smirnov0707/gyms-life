# Twin posterior selection edge — per-fragment refinement

Base: PR149 f74861f5875bb93ba5ef248c608570b642fa5679 on released main 3967daa8.

The first vertex-distance prototype passed automated checks but still showed coarse triangular transitions in screenshots. It is replaced, not shipped alongside another competing path.

The registered generic Body back alone now uses a 256 × 256 single-channel field derived from its own XY triangle footprint. A smoothed signed chamfer-distance field softens the selection transition inside that footprint. A guard term keeps its existing border neutral. Per-fragment sampling avoids dependence on the coarse mesh's vertex spacing. Roughness returns to the neutral skin value with the same mask, preventing a selected-material sheen from retaining a hard triangle boundary.

This is graphic treatment, not an anatomical measurement, personal scan, muscle-growth estimate or evidence source. Application is still gated by registered asset identity, Body appearance and back region. The Analysis model, other regions and personal Identity Shells are unchanged. Positions, indices, normals, UVs and picking stay intact; no asset bytes, database, providers or dependencies change.

One R8 field is 65,536 bytes before driver overhead, with no mipmaps. No mesh or draw call is added. It is generated once per model load and disposed with its material; this is not a physical-iPhone performance claim.

The source contract and full unit/TypeScript/lint/build gates must pass. The real WebGL comparison retains an unfeathered reference through a test-only source transform, never a production switch. It checks exact asset identity, absent evidence remaining absent, and a substantial visible back selection in both themes and two viewports. Screenshot review remains required. Neither synthetic browser tests nor public HTTP smoke establishes real-account or physical-device acceptance.
