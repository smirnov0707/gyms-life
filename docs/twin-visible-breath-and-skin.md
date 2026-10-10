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

## Eye reflections

The verified natural model's fitted eyes use a separate opaque physical material over the unchanged brown-eye atlas. A clear coating and two neutral studio reflectors make the iris/eye surface readable without emissive glow or a second transparent cornea mesh. The small 256×128 reflection texture is generated locally, owned by that eye material and released with the model; no external environment file or additional request is needed. Other models and personal Identity Shells retain their own eye presentation.

Natural-model browser evidence includes front and three-quarter face views. A real render/dispose check loads the model twice, verifies the reflection texture is disposed exactly once per model, and checks that retained GPU texture counts do not grow between cycles. Native eye geometry, UVs, body regions and breathing are unchanged.
