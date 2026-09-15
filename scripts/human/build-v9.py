#!/usr/bin/env python3
"""Export the v8 morphology, then author the actual exported MTL diffuse.

Requires the pinned makehuman-core checkout on PYTHONPATH plus numpy/Pillow.
No upstream texture is edited. Output is review-only, never production-approved.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

UPSTREAM_REV = "06e129ac920593f9f315e03d6d5b3f843504de7f"
MODIFIERS = [
    ("head/head-oval", .035), ("head/head-rectangular", .07),
    ("head/head-scale-depth-decr|incr", .015),
    ("nose/nose-scale-vert-decr|incr", .02), ("nose/nose-width2-decr|incr", .025),
    ("chin/chin-jaw-drop-decr|incr", -.58), ("chin/chin-width-decr|incr", .115),
    ("chin/chin-bones-decr|incr", .075), ("mouth/mouth-scale-vert-decr|incr", -.17),
    ("mouth/mouth-scale-horiz-decr|incr", .01),
    ("mouth/mouth-lowerlip-volume-decr|incr", -.055),
    ("mouth/mouth-upperlip-volume-decr|incr", -.05),
    ("eyes/r-eye-scale-decr|incr", -.06), ("eyes/l-eye-scale-decr|incr", -.06),
]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def orange(rgb):
    r, g, b = np.moveaxis(rgb, -1, 0)
    return (r > .50) & (g > .12) & (g < .62) & (b < .22) & (rgb.max(-1)-rgb.min(-1) > .28)


def connected(mask, uv):
    """Keep the seeded UV component; do not classify face/hair as clothing."""
    im = Image.fromarray(np.uint8(mask)*255).copy()
    xy = (round(uv[0]*(im.width-1)), round(uv[1]*(im.height-1)))
    if im.getpixel(xy) != 255:
        raise ValueError("Pinned garment UV seed is not in the suit")
    ImageDraw.floodfill(im, xy, 128)
    return np.asarray(im) == 128


def garment_uv_island(obj, body_material, size):
    """Rasterize the actual body UV island containing the suit seed.

    Connected image colours alone can join the suit to the adjacent scalp.
    OBJ UV topology provides the boundary, independent of skin/hair colour.
    """
    uv, faces, current = [], [], None
    for line in obj.read_text().splitlines():
        if line.startswith("vt "):
            uv.append(tuple(map(float, line.split()[1:3])))
        elif line.startswith("usemtl "):
            current = line[7:].strip()
        elif line.startswith("f ") and current == body_material:
            faces.append([int(token.split("/")[1])-1 for token in line.split()[1:]])
    parent = list(range(len(uv)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for face in faces:
        for i in face[1:]:
            parent[find(i)] = find(face[0])
    groups = {}
    for face in faces:
        groups.setdefault(find(face[0]), []).append(face)
    seed = (round(.38*(size[0]-1)), round(.30*(size[1]-1)))
    matches = []
    for group in groups.values():
        island = Image.new("L", size)
        draw = ImageDraw.Draw(island)
        for face in group:
            draw.polygon([(uv[i][0]*(size[0]-1), (1-uv[i][1])*(size[1]-1)) for i in face], fill=255)
        if island.getpixel(seed):
            matches.append(island)
    if len(matches) != 1:
        raise ValueError(f"Expected one garment UV island, found {len(matches)}")
    return matches[0].filter(ImageFilter.MaxFilter(9))


def garment_mask(rgb, uv_island):
    # This segmentation is for the pinned HM08 special-suit atlas. Unlike v8,
    # it starts from the connected garment, never a dilated warm-skin mask.
    r, g, b = np.moveaxis(rgb, -1, 0)
    candidate = (((rgb.max(-1) < .58) & (abs(r-g) < .12) & (abs(g-b) < .12)) | orange(rgb)) & (np.asarray(uv_island) > 0)
    component = connected(candidate, (.38, .30))
    # Interior white grid lines are holes in the same garment region.
    im = Image.fromarray(np.uint8(component)*255).copy()
    ImageDraw.floodfill(im, (0, 0), 128)
    filled = np.asarray(im) != 128
    # Two texels of outward coverage remove anti-aliasing at orange cuffs.
    expanded = Image.fromarray(np.uint8(filled)*255).filter(ImageFilter.MaxFilter(5))
    weight = np.asarray(expanded.filter(ImageFilter.GaussianBlur(.65)), dtype=np.float32)/255
    # A soft edge must never reintroduce guide art. Garment wins at every
    # original garment texel, even after dilation/feathering.
    weight[filled] = 1
    if not .25 < float(filled.mean()) < .65:
        raise ValueError("Unexpected garment area; refuse to overwrite this UV atlas")
    return filled, weight


def authored_body(source, donor, output, obj, body_material):
    original = Image.open(source).convert("RGB")
    skin = Image.open(donor).convert("RGB")
    if original.size != (2048, 2048) or skin.size != original.size:
        raise ValueError("Donor and garment must share the pinned 2048² HM08 atlas")
    rgb = np.asarray(original, dtype=np.float32)/255
    donor_rgb = np.asarray(skin, dtype=np.float32)/255
    island = garment_uv_island(obj, body_material, original.size)
    island.save(output.parent/"garment-uv-island.png")
    mask, weight = garment_mask(rgb, island)
    rng = np.random.default_rng(9001)
    noise = rng.normal(0, 1, mask.shape).astype(np.float32)
    # Original albedo/grid cannot leak into cloth or its normal map.
    blurred = np.asarray(Image.fromarray(np.uint8(np.clip(noise*18+128, 0, 255))).filter(ImageFilter.GaussianBlur(7)), dtype=np.float32)/255-.5
    fabric = np.stack([np.clip(base + noise*.0018 + blurred*.018, 0, 1) for base in (.083, .100, .116)], -1)
    result = donor_rgb*(1-weight[..., None]) + fabric*weight[..., None]
    Image.fromarray(np.uint8(np.clip(result*255, 0, 255))).save(output, quality=91, optimize=True, progressive=True, subsampling=0)
    Image.fromarray(np.uint8(mask)*255).save(output.parent/"garment-mask.png")
    Image.fromarray(np.uint8((1-weight)*255)).save(output.parent/"donor-skin-mask.png")
    original.save(output.parent/"exported-diffuse-before.png")
    decoded = np.asarray(Image.open(output).convert("RGB"), dtype=np.float32)/255
    before_guide = orange(rgb) & mask
    residual = int((orange(decoded) & mask).sum())
    # Neutral, subtle microdetail; no gradient from anatomical guide artwork.
    detail = rng.normal(0, .004, (1024, 1024, 2)).astype(np.float32)
    normal = np.dstack([.5+detail[..., 0], .5+detail[..., 1], np.ones((1024, 1024))])
    normal_path = output.parent/"surface-detail-normal.jpg"
    Image.fromarray(np.uint8(np.clip(normal*255, 0, 255))).save(normal_path, quality=87, optimize=True, progressive=True, subsampling=0)
    if int(before_guide.sum()) < 100000 or residual != 0:
        raise ValueError(f"Guide removal diagnostic failed: before={before_guide.sum()}, after={residual}")
    return {
        "source_sha256": sha(source), "donor_sha256": sha(donor),
        "output_sha256": sha(output), "normal_sha256": sha(normal_path),
        "garment_mask_sha256": sha(output.parent/"garment-mask.png"),
        "source_size": list(original.size), "donor_size": list(skin.size),
        "uv_basis": "same pinned HM08 body; material-only skin swap, no UV override",
        "donor_regions": "uncovered head, neck, hands and feet; UV fit remains subject to visual review",
        "garment_fraction": float(mask.mean()),
        "guide_pixels_before": int(before_guide.sum()), "guide_pixels_after_jpeg": residual,
        "visual_acceptance": False,
    }


def authored_eyes(source, output):
    # Same treatment as v8, performed on exported diffuse rather than source data.
    eye = Image.open(source).convert("RGBA")
    e = np.asarray(eye).copy()
    h, w = e.shape[:2]
    y, x = np.ogrid[:h, :w]
    mask = np.zeros((h, w), bool)
    for cx, cy, rad in [(.31, .69, .145), (.71, .31, .145)]:
        mask |= (x-w*cx)**2+(y-h*cy)**2 <= (w*rad)**2
    rgb = e[..., :3].astype(np.float32)/255
    mx, mn = rgb.max(-1), rgb.min(-1)
    iris = mask & ((mx-mn) > .14) & (mx < .86)
    lum = rgb[..., 0]*.28 + rgb[..., 1]*.56 + rgb[..., 2]*.16
    for c, v in enumerate((.09+lum*.36, .055+lum*.23, .025+lum*.105)):
        rgb[..., c][iris] = np.clip(v[iris], 0, 1)
    scl = mask & ~iris & (mx > .42)
    avg = rgb.mean(-1)
    rgb[..., 0][scl] = rgb[..., 0][scl]*.54 + avg[scl]*.46
    rgb[..., 1][scl] = rgb[..., 1][scl]*.76 + avg[scl]*.24
    e[..., :3] = np.uint8(np.clip(rgb*255, 0, 255))
    tex = Image.fromarray(e)
    tex.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    tex.save(output, optimize=True)


def mtl_diffuses(mtl):
    material = None
    maps = {}
    for line in mtl.read_text().splitlines():
        parts = shlex.split(line, comments=True)
        if not parts:
            continue
        if parts[0] == "newmtl":
            material = " ".join(parts[1:])
        if parts[0] == "map_Kd":
            if len(parts) != 2 or material is None or material in maps:
                raise ValueError("Ambiguous exported diffuse; expected one plain map_Kd per material")
            path = (mtl.parent/parts[1]).resolve()
            if not path.is_relative_to(mtl.parent.resolve()) or not path.is_file():
                raise ValueError(f"Diffuse must be an existing exported file inside output: {path}")
            maps[material] = path
    return maps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    source, root = args.source.resolve(), args.out.resolve()
    revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    if revision != UPSTREAM_REV:
        raise ValueError(f"Expected upstream {UPSTREAM_REV}, got {revision}")
    root.mkdir(parents=True, exist_ok=True)
    os.environ["MHCORE_DATA"] = str(source/"data")
    os.environ["MH_HOME_LOCATION"] = str(root/"authoring-home")
    import sys
    sys.path.insert(0, str(source))
    import mhcore

    h = mhcore.new_human()
    h.set_gender(1.).set_age(.46).set_weight(.52).set_muscle(.64).set_height(.62)
    for name, value in MODIFIERS:
        h.apply_modifier(name, value)
    def pick(kind, directory):
        matches = [p for p in h.list_available(kind) if Path(p).parent.name == directory]
        if len(matches) != 1:
            raise ValueError(f"Expected one {kind}/{directory}, got {matches}")
        return matches[0]
    h.set_skin(pick("skins", "young_caucasian_male_special_suit"))
    h.equip_eyes(pick("eyes", "high-poly"))
    h.save_mhm(str(root/"gyms-digital-human-v9.mhm"))
    obj = Path(h.export(str(root/"gyms-digital-human-v9.obj")))
    mtl = obj.with_suffix(".mtl")
    before_mtl = mtl.read_text()
    (root/"exported-before.mtl").write_text(before_mtl)
    obj_sha = sha(obj)
    # Choose the material actually bound to the body's faces, not a filename guess.
    material, faces = None, {}
    for line in obj.read_text().splitlines():
        if line.startswith("usemtl "):
            material = line[7:].strip()
        elif line.startswith("f "):
            faces[material] = faces.get(material, 0)+1
    body = max(faces, key=faces.get)
    maps = mtl_diffuses(mtl)
    if len(maps) != 2 or body not in maps:
        raise ValueError("Expected a single body surface plus eyes")
    donor_material = source/"data/skins/middleage_caucasian_male/middleage_caucasian_male.mhmat"
    source_material = source/"data/skins/young_caucasian_male_special_suit/young_caucasian_male_special_suit.mhmat"
    for material_path in (donor_material, source_material):
        if any(line.lower().startswith("uvmap ") for line in material_path.read_text().splitlines()):
            raise ValueError("UV override requires an explicit compatibility review")
    donor_name = next(line.split(maxsplit=1)[1] for line in donor_material.read_text().splitlines() if line.startswith("diffuseTexture "))
    donor = donor_material.parent/donor_name
    body_output = root/"gyms-v9-skin-and-graphite.jpg"
    diagnostics = authored_body(maps[body], donor, body_output, obj, body)
    replacement = {body: body_output.name}
    for name, path in maps.items():
        if name != body:
            output = root/"brown-eye-v9.png"
            authored_eyes(path, output)
            replacement[name] = output.name
    current, rewritten = None, []
    for line in before_mtl.splitlines():
        parts = shlex.split(line, comments=True)
        if parts and parts[0] == "newmtl":
            current = " ".join(parts[1:])
        if parts and parts[0] in ("map_D", "map_d", "map_Bump", "bump", "map_Ks"):
            continue
        if parts and parts[0] == "map_Kd":
            line = "map_Kd "+replacement[current]
            rewritten.append(line)
            if current == body:
                rewritten.append("map_Bump surface-detail-normal.jpg")
            continue
        rewritten.append(line)
    mtl.write_text("\n".join(rewritten)+"\n")
    if sha(obj) != obj_sha:
        raise ValueError("Texture authoring changed OBJ geometry")
    manifest = {
        "name": "GYMS.LIFE Digital Human v9 review candidate",
        "upstream_repository": "https://github.com/vidya-hub/makehuman-core",
        "upstream_revision": revision,
        "graphical_assets_license": "CC0-1.0; authoring application code is not bundled",
        "license_source": "https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html",
        "personal_scan": False, "identity_claim": False,
        "body_parameters": {"gender": 1., "age": .46, "weight": .52, "muscle": .64, "height": .62},
        "modifiers": MODIFIERS, "body_material": body, "face_counts_by_material": faces,
        "single_body_surface_plus_eyes": True, "separate_garment_shells": 0,
        "exported_obj_sha256_before_and_after": obj_sha,
        "exported_mtl_sha256_before": sha(root/"exported-before.mtl"),
        "authored_mtl_sha256": sha(mtl),
        "resolved_exported_diffuse": str(maps[body].relative_to(root)),
        "source_material_sha256": sha(source_material), "donor_material_sha256": sha(donor_material),
        "texture_diagnostics": diagnostics,
        "visual_acceptance": False, "production_eligible": False,
    }
    (root/"SOURCE_MANIFEST.json").write_text(json.dumps(manifest, indent=2)+"\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
