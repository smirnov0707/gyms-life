# Twin natural skin and muscle-selection clarity

The default analytical body and the Body view use a generic warm skin material, not an inferred personal skin colour. Existing mesh assets, provenance, region picking, geometry, camera controls and evidence calculations are unchanged. A neutral region remains skin-coloured even when no measurement is present. Selecting it adds a blue surface tint and ice-coloured edge; this means selection, not recovery or fatigue. Known evidence retains the existing semantic hues. The edge is drawn in the existing opaque, depth-tested surface shader, respects regional masks and adds no translucent body shells or postprocessing.

The simplified 3D fallback shares the same palette. Private textured identity shells retain their own underlying identity surface. This change does not turn a generic body into a personal scan.

Validation must include real rendered WebGL pixels for natural skin and selection, both visual modes, front/back regions and narrow/wide views, plus the normal Twin and Today regression gates. Unit tests alone cannot prove visual clarity.
