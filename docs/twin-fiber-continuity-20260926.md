# Fiber continuity and neutral silhouette lighting

The September 9 sculpt turntables show abrupt stripe direction changes where
shoulder guides overlap. The shader selected a single winning guide at each
fragment, so a tiny support change could replace its entire fiber phase. It also
multiplied the studio rim by the data mask after adding the rim, making neutral
material seams lose their edge lighting.

The new shader blends periodic fiber signals with fourth-power support weights.
It fades fiber contrast when conflicting signals cancel, guards the zero-signal
case before `atan`, and retains screen-space antialiasing. Color ownership,
region masks, bounds, competition and geometry are unchanged. The data emissive
term is masked before adding the independent studio rim. Existing assets without
sculpt contours retain their UV fiber path.

The input remains the exact registered sculpt GLB with SHA-256
`e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31`.
No public model is replaced. Geometric, medical and personal-body claims are not
added. The eight data regions and source/error behavior remain unchanged.

The original PR #55 was merged on September 10; its description's draft status
is historical. This follow-up is prepared against current main
`afce99fe56cdad51ca0bb1fbcd7840d8fdde9e13` in a separate review branch.
No merge or production deployment is authorized by this change.

Regression checks cover masked/unmasked rim ordering, the zero-signal guard,
overlap blending, existing UV shader paths and shader program separation.
The candidate browser workflow renders the same full-body and torso
front/side/back views with the unchanged input hash. These checks do not make
the model pixel-identical to the supplied reference images: the broader shape,
material-region coverage and final reference fidelity still require review.
`visualGatePassed` remains false.
