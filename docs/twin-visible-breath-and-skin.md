# Visible resting motion and native skin

The previous 2–3 mm forward-only breath barely registered in a full-body phone view. The new decorative cycle adds lateral rib expansion and a small vertical lift, with a 1.9 s inhale, 3 s release and 0.3 s resting pause. The abdomen moves more gently. Head, hands and feet remain fixed. The surface morph is also used by Three's raycasting. Motion preferences, offscreen suspension and the existing user toggle still apply. This is an illustration, not measured respiration.

`public/models/twin-natural-skin-v1.glb` retains every oriented triangle and position of the registered natural-v1 body. UV seam duplication, smooth shading normals, and an embedded skin texture change the body presentation. Native fitted low-poly eye meshes fill the empty sockets; they carry no data regions. Native UVs are transferred through exact original-vertex/edge-midpoint correspondence, preserving each source triangle's UV chart. OBJ V coordinates are converted to glTF's top-left convention. No nearest-surface projection is used across limbs or seams.

## Source and reproduction

- Source: https://github.com/vidya-hub/makehuman-core at `06e129ac920593f9f315e03d6d5b3f843504de7f`.
- Native body/pose: existing `scripts/authoring/pose-native-muscle.py` recipe, including its fitted proxy and native UV correspondence.
- Skin: `data/skins/young_caucasian_male/young_lightskinned_male_diffuse.png`, SHA-256 `862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963`.
- The accompanying `young_caucasian_male.mhmat`, `data/eyes/low-poly/low-poly.mhclo` and `data/eyes/materials/brown.mhmat` explicitly release the asset as CC0 in September 2020, crediting Data Collection AB, Joel Palmius and Jonas Hauquier. MakeHuman's software code is not embedded in the app.
- Asset license: CC0-1.0. This is one generic presentation character, not the athlete's face, skin colour or personal scan.

Run the existing pose authoring script, then fit the eyes and transfer both texture atlases:

```sh
python scripts/authoring/export-natural-eyes.py /path/to/makehuman-core /path/to/eye-output /path/to/posed-correspondence.npz
python scripts/authoring/texture-natural-twin.py /path/to/posed-correspondence.npz /path/to/young_lightskinned_male_diffuse.png /path/to/eye-output/eyes.npz /path/to/brown_eye.png
```

Python authoring uses NumPy, SciPy and Pillow. The embedded 2048px JPEG adds approximately 431 KB. Runtime uses the verified GLB's sRGB texture, keeps data/selection masks, and releases the shared textures and decoded ImageBitmaps when the scene is disposed. A decoding failure cannot silently claim a textured result.

The separate BodyParts3D Body appearance, identity shells and database are unchanged. This improves the generic model; it is not a claim of photorealism, a real person's likeness or anatomical validation.

## Skin finish

The textured natural model uses a rest-space procedural finish: modest roughness variation and a bounded shading-normal perturbation that fades before becoming subpixel. Positions, silhouettes, breathing morphs and picking geometry are unchanged. Eyes are excluded; no extra textures, requests or decoded images are created. The detail is decorative and is not derived from athlete measurements.

Each material now retains its authored neutral roughness through selection/data updates. Previously the shared state loop reset all region materials to 0.72 even when the loaded skin used 0.76, creating a different finish from adjoining neutral skin. Feathered region edges keep their neutral roughness. A regression test covers repeated selection/deselection without roughness drift; the natural browser evidence includes a close head/shoulder view under the production CSP.

The finish also distinguishes the forehead, nose and lips with softly feathered roughness regions fitted to this asset's rest coordinates. Fine vein strands extend from the forearms into the upper arms, dorsal hands and calves, with thinner branches and slight left/right variation. Normal-facing masks keep the dorsal detail off the palms. The same vessel field contributes a small shading relief through the existing bounded normal perturbation; it does not displace geometry. Pixel derivatives are computed before spatial branches, and subpixel filtering softens distant strands. Selected data regions still suppress this decorative pigment. Browser evidence now captures front/back hands and calves as well as the torso and face.

## Eye reflections

The verified natural model's fitted eyes use a separate opaque physical material over the unchanged brown-eye atlas. A clear coating and two neutral studio reflectors make the iris/eye surface readable without emissive glow or a second transparent cornea mesh. The small 256×128 reflection texture is generated locally, owned by that eye material and released with the model; no external environment file or additional request is needed. Other models and personal Identity Shells retain their own eye presentation.

Natural-model browser evidence includes front and three-quarter face views. A real render/dispose check loads the model twice, verifies the reflection texture is disposed exactly once per model, and checks that retained GPU texture counts do not grow between cycles. Native eye geometry, UVs, body regions and breathing are unchanged.

## Living idle pose

The verified natural skin asset adds independent low-amplitude stance, head and arm morphs alongside breathing. Feet remain planted; the head and fitted eyes move together. Normals follow the deformation through an inverse-transpose Jacobian. These are decorative rest movements, not measured balance or a medical simulation. No additional animation loop, texture or network request is added; the existing 30 fps cap, offscreen suspension, reduced-motion preference and motion switch govern all movement.

Blinking uses the native CC0 `LeftUpperLidClosed` and `RightUpperLidClosed` face pose units from the same MakeHuman revision as the skin. `scripts/authoring/export-twin-blink.py` reproduces the fitted proxy/pose, applies those units through the source rig and transfers displacements via exact original-vertex/edge-midpoint correspondence. The 380 affected atlas vertices are stored in `twin-blink-data.json`, used only on the exact registered asset's neutral mesh. Eyes are not flattened or scaled. Uneven intervals include an occasional double blink, a fast close and a slower release. Source license/credits: `data/poseunits/face-poseunits.json`, CC0, Data Collection AB, Joel Palmius and Jonas Hauquier (2020).

GPU morphs and Three's raycast share the deformed positions; the near-side selection axis also follows the idle pose. Bounds cover combined positive/negative morph weights. Asset-level tests verify eyelid occlusion, planted feet, position immutability, moving ray hits and reset. Chromium/WebKit evidence includes open/closed/reopened eyelids and two body poses. Production smoke requires live stance changes and a blink as well as breathing.

## Chest texture fit and gym backdrop

The refined generic body placed the two painted chest landmarks at approximately y=1.331 m, visually below its pectoral form. `fitTwinChestTexture` applies one smooth, local UV correction on this exact registered skin asset, raising both to approximately y=1.38 m. It runs once per geometry; the original GLB, positions, normals, region masks, eyes and breathing remain unchanged. An asset-level test locates both painted atlas landmarks on the actual triangles, checks left/right alignment and rejects inverted UV triangles. This is a visual fit for this generic model, not an athlete measurement or anatomical diagnosis.

The old blue rings, grid, particles and centre-axis nodes have been removed. The viewport displays a decorative gym photo plate beneath the transparent canvas, retaining the contact shade and neutral skin lighting. The local 1024×1536 WebP is 174,956 bytes, shares the normal browser image cache and does not intercept gestures. If it cannot load, the warm dark viewport remains usable. Natural browser checks decode the actual background in four viewport sizes; live release checks also require it to load.

Background asset: `public/assets/ai/twin-private-gym-v1.webp`. Created with the built-in `imagegen` tool, then encoded as WebP for the project. Generation prompt:

> Use case: photorealistic-natural. Asset type: background plate for an interactive full-body fitness avatar in a mobile web app, portrait 2:3 composition. Create a photorealistic empty luxury private gym interior. Restrained architectural photography, refined dark charcoal stone, smoked oak wall panels, brushed bronze details, warm recessed ceiling strip lighting, black premium exercise equipment and a neat dumbbell rack along the side walls, a large unobstructed central workout floor. The central 45 percent must be quiet and free of equipment, ready to place a standing 3D human avatar in front; the room should remain recognizable when centrally cropped to a tall mobile viewport. Camera straight and level, subtle depth and natural perspective, not a fisheye. Warm neutral grey and dark walnut palette, enough light to read the gym but a darker uncluttered center behind the body. Matte dark rubber floor in the foreground with soft believable lighting; no spotlight rings, no grids, no futuristic holograms, no floating particles. No people, no silhouettes, no reflections of people, no text, no brand logos, no watermark. An elegant real space, not a nightclub or sci-fi lab. This is the actual background image asset, not a screenshot or UI mockup.
