# Continuous anatomy review candidate

This fixture is an isolated authoring experiment. The production loader still
uses `public/models/twin-anatomy-v1.glb`. Enable the candidate only in the browser
harness with `TWIN_ANATOMY_CANDIDATE=1`.

The candidate extracts the exterior of BodyParts3D's registered skin organ,
removes its inner wall, closes small openings, and projects superficial muscle
regions onto that continuous surface. Eight muscle regions carry procedural
fiber coordinates; those directions are presentation details, not validated
anatomical measurements. There are no garment meshes or transparent body shells.

Source: [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/).

BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan

This adaptation retains that license. The application displays the attribution
under the figure. Build instructions are in `scripts/authoring/README.md`.

`anatomy-candidate.audit.json` and `khronos-validation.json` identify the reviewed
bytes. Technical validity does not approve reference fidelity. Multi-angle GPU
renders and the visual gate remain required before any production asset change.
