#!/usr/bin/env python3
"""Isolated MakeHuman authoring: fit native CC0 proxy after registered modifiers."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import numpy as np

REVISION = "06e129ac920593f9f315e03d6d5b3f843504de7f"
MACROS = {"gender": 1.0, "age": .5, "weight": .42, "muscle": .86, "height": .58}
DETAILS = {
    "torso/torso-muscle-pectoral-decr|incr": .8,
    "stomach/stomach-tone-decr|incr": .8,
    "torso/torso-muscle-dorsi-decr|incr": .5,
}
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
source, out = args.source.resolve(), args.output.resolve()
if "public" in out.parts or out == source or out.is_relative_to(source):
    raise ValueError("Explicit isolated output required; public/source writes forbidden")
if subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip() != REVISION:
    raise ValueError("Unexpected source revision")
out.mkdir(parents=True, exist_ok=True)
os.environ["MHCORE_DATA"] = str(source/"data")
os.environ["MH_HOME_LOCATION"] = str(out/"authoring-home")
sys.path.insert(0, str(source))
import mhcore
from mhcore import assets

h = mhcore.new_human()
for key, value in MACROS.items():
    getattr(h, "set_"+key)(value)
skin = source/"data/skins/middleage_caucasian_male/middleage_caucasian_male.mhmat"
h.set_skin(str(skin))
proxy_path = source/"data/proxymeshes/male_muscle_13290/male_muscle_13290.proxy"
p = assets._load_proxy(h.human, str(proxy_path), "Proxymeshes")
baseline = p.getCoords().copy()
detail_effect = {}
for name, value in DETAILS.items():
    before = p.getCoords().copy()
    h.apply_modifier(name, value)
    delta_m = np.linalg.norm((p.getCoords()-before)*.1, axis=1)
    detail_effect[name] = {"power": value, "affectedProxyVertices": int((delta_m>1e-7).sum()), "maximumDisplacementMetres": float(delta_m.max()), "rmsDisplacementMetres": float(np.sqrt(np.mean(delta_m**2)))}
h.human.setProxy(p)
h.human.updateProxyMesh()
active = h.human.getProxyMesh()
expected = p.getCoords()
fit_error = float(np.abs(active.coord-expected).max())
if fit_error > 1e-6 or len(active.coord) != 13290:
    raise ValueError(f"Native active proxy fit failed: {fit_error}")
if h.human.clothesProxies or h.human.eyesProxy or h.human.hairProxy:
    raise ValueError("Only the single body proxy may be exported")
h.save_mhm(str(out/"muscular-native.mhm"))
obj = Path(h.export(str(out/"muscular-native.obj")))
np.savez_compressed(out/"native-correspondence.npz", baselineCoordinatesNative=baseline,
    fittedCoordinatesNative=expected, quads=active.fvert, uv=active.texco,
    faceUv=active.fuvs, hm08ReferenceIndices=p.ref_vIdxs, hm08ReferenceWeights=p.weights)
targets = h.get_applied_targets()
source_paths = [proxy_path, proxy_path.with_suffix(".obj"), source/"data/3dobjs/base.obj", skin]
for relative in targets:
    path = source/relative
    if not path.is_file():
        path = source/"data"/relative
    if not path.is_file():
        path = source/"data/targets"/relative
    if not path.is_file():
        raise ValueError(f"Unresolved applied target: {relative}")
    source_paths.append(path)
snapshot = {
    "candidateOnly": True, "visualGatePassed": False, "productionIntegration": False,
    "sourceRepository": "https://github.com/vidya-hub/makehuman-core", "sourceRevision": REVISION,
    "assetLicense": "CC0-1.0", "proxyUuid": p.uuid, "baseMesh": "hm08",
    "macros": MACROS, "registeredModifiers": DETAILS, "appliedTargets": targets,
    "modifierEffectsOnNativeFittedProxy": detail_effect, "nativeFitMaximumCoordinateError": fit_error,
    "pipeline": ["Registered macro/modifier API modifies HM08 base", "Native Proxymeshes loader reads authored barycentric references", "Human.setProxy and updateProxyMesh fit active body after modifiers", "Native MakeHuman OBJ exporter uses metres and feet-on-ground"],
    "objSha256": sha(obj), "correspondenceSha256": sha(out/"native-correspondence.npz"),
    "sources": [{"path": str(path.relative_to(source)), "sha256": sha(path)} for path in sorted(set(source_paths))],
    "remainingGates": ["Independent topology and glTF audit", "GPU multi-angle visual review", "Muscle-region calibration: absent; no invented eight-region labels", "Pose matching to reference", "Eyes/head/hand visual review", "Self-intersection review"],
    "limitations": ["Generic authored morphology, not a personal body measurement or physiological estimate", "Pectoral/stomach values are authoring controls, not anatomical confidence", "Resting source pose retained", "No clothing, hair, eyeball or overlapping muscle shell added", "Native UVs retained in correspondence; neutral review GLB intentionally has no source skin texture"],
}
(out/"native-export.snapshot.json").write_text(json.dumps(snapshot, indent=2)+"\n")
print(json.dumps({"obj": str(obj), "sha256": sha(obj), "fitError": fit_error, "modifierEffects": detail_effect}, indent=2))
