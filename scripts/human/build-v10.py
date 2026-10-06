#!/usr/bin/env python3
"""Material-only v10 review candidate from a verified v9 export.

No application/runtime imports, network access, rig changes or approval claims.
The existing audit-authored-textures.py independently checks the written GLB.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

V9_HASHES = frozenset({
    "4a9ed814f835e3be0036ba21af79cd1396a4b0d236c353ebb162d2ad428091e6",
    "b4b05544adbff0d0ca8bb159330e031ccc917e8f31a4100a2a8bd08ccb6e1b38",
})
# Decoded pins survive PNG/zlib differences between the documented local/CI v9s.
SOURCE_RGB_SHA = "6a4acebe8281d05786f3e3af170ab52c37e796e76820f5f6556658574b829bd5"
GARMENT_L_SHA = "203646cda5757c5966123a271b8230eee047470cef10952202127d29ab95542c"
WEIGHT_L_SHA = "991c3c50372792fabb736fc432bab9b2dd1fda073a418d476fb6a79b4db0c9e0"
BODY = "young_caucasian_male_detailed"
EYES = "Eye_brown"
BUDGET = 8 * 1024 * 1024


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Glb:
    """Small editor for the pinned, uncompressed, single-buffer review asset."""

    def __init__(self, raw: bytes):
        require(len(raw) >= 28, "Truncated GLB")
        magic, version, length = struct.unpack_from("<4sII", raw)
        require((magic, version, length) == (b"glTF", 2, len(raw)), "Invalid GLB header")
        cursor, chunks = 12, []
        while cursor < len(raw):
            require(cursor + 8 <= len(raw), "Truncated chunk header")
            size, kind = struct.unpack_from("<II", raw, cursor)
            cursor += 8
            require(size % 4 == 0 and cursor + size <= len(raw), "Invalid chunk range")
            chunks.append((kind, raw[cursor:cursor + size]))
            cursor += size
        require([c[0] for c in chunks] == [0x4E4F534A, 0x004E4942], "Expected JSON/BIN only")
        self.doc = json.loads(chunks[0][1])
        doc, binary = self.doc, chunks[1][1]
        require(doc.get("asset", {}).get("version") == "2.0", "Not glTF 2.0")
        require(not doc.get("extensionsUsed") and not doc.get("extensionsRequired"), "Extensions need separate review")
        require(len(doc.get("buffers", [])) == 1 and "uri" not in doc["buffers"][0], "Embedded buffer required")
        require(0 <= len(binary) - doc["buffers"][0]["byteLength"] <= 3, "Invalid buffer size")
        self.payloads = []
        for view in doc["bufferViews"]:
            offset, size = view.get("byteOffset", 0), view["byteLength"]
            require(view.get("buffer", 0) == 0 and offset >= 0 and size > 0 and offset + size <= doc["buffers"][0]["byteLength"], "Invalid buffer view")
            self.payloads.append(binary[offset:offset + size])
        for image in doc["images"]:
            require("uri" not in image and 0 <= image.get("bufferView", -1) < len(self.payloads), "Embedded image required")

    def array(self, index: int) -> np.ndarray:
        a = self.doc["accessors"][index]
        require("sparse" not in a and not a.get("normalized", False), "Unsupported accessor")
        types = {5126: "<f4", 5123: "<u2", 5125: "<u4"}
        widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}
        require(a["componentType"] in types and a["type"] in widths, "Unsupported accessor type")
        dtype, width = np.dtype(types[a["componentType"]]), widths[a["type"]]
        view = self.doc["bufferViews"][a["bufferView"]]
        stride = view.get("byteStride", dtype.itemsize * width)
        offset, count = a.get("byteOffset", 0), a["count"]
        require(count > 0 and offset >= 0 and stride >= dtype.itemsize * width, "Invalid accessor layout")
        require(offset + (count - 1) * stride + width * dtype.itemsize <= len(self.payloads[a["bufferView"]]), "Accessor outside buffer")
        return np.ndarray((count, width), dtype=dtype, buffer=self.payloads[a["bufferView"]], offset=offset, strides=(stride, dtype.itemsize)).copy()

    def material(self, name: str) -> tuple[int, dict]:
        matches = [(i, m) for i, m in enumerate(self.doc["materials"]) if m.get("name") == name]
        require(len(matches) == 1, f"Ambiguous material: {name}")
        return matches[0]

    def image_index(self, texture: dict) -> int:
        require(texture.get("texCoord", 0) == 0, "Expected UV0")
        return self.doc["textures"][texture["index"]]["source"]

    def image_bytes(self, index: int) -> bytes:
        return self.payloads[self.doc["images"][index]["bufferView"]]

    def replace_image(self, index: int, data: bytes, mime: str, name: str) -> None:
        image = self.doc["images"][index]
        self.payloads[image["bufferView"]] = data
        image.update(mimeType=mime, name=name)

    def add_texture(self, data: bytes, mime: str, name: str, sampler: int) -> int:
        view_id, image_id = len(self.payloads), len(self.doc["images"])
        self.payloads.append(data)
        self.doc["bufferViews"].append({"buffer": 0, "byteLength": len(data)})
        self.doc["images"].append({"bufferView": view_id, "mimeType": mime, "name": name})
        index = len(self.doc["textures"])
        self.doc["textures"].append({"source": image_id, "sampler": sampler, "name": name})
        return index

    def encode(self) -> bytes:
        binary = bytearray()
        for view, data in zip(self.doc["bufferViews"], self.payloads, strict=True):
            binary.extend(b"\0" * (-len(binary) % 4))
            view.update(buffer=0, byteOffset=len(binary), byteLength=len(data))
            binary.extend(data)
        self.doc["buffers"][0]["byteLength"] = len(binary)
        binary.extend(b"\0" * (-len(binary) % 4))
        text = json.dumps(self.doc, separators=(",", ":"), allow_nan=False).encode()
        text += b" " * (-len(text) % 4)
        return (struct.pack("<4sII", b"glTF", 2, 28 + len(text) + len(binary))
                + struct.pack("<II", len(text), 0x4E4F534A) + text
                + struct.pack("<II", len(binary), 0x004E4942) + binary)


def image_bytes(array: np.ndarray, fmt: str) -> bytes:
    image = Image.fromarray(array.astype(np.uint8))
    out = io.BytesIO()
    if fmt == "JPEG":
        image.save(out, format=fmt, quality=94, subsampling=0, optimize=True, progressive=True)
    else:
        image.save(out, format=fmt, optimize=True)
    return out.getvalue()


def pinned_image(path: Path, mode: str, expected: str) -> np.ndarray:
    with Image.open(path) as image:
        converted = image.convert(mode)
        require(converted.size == (2048, 2048), "Expected pinned 2048-square atlas")
        require(sha(converted.tobytes()) == expected, f"Unexpected decoded source: {path.name}")
        return np.asarray(converted).copy()


def head_island(glb: Glb, size: tuple[int, int]) -> np.ndarray:
    """Find the face-seeded UV component, not dark pixels near the garment.

    UV seams duplicate vertices. Join exact UV coordinates, then rasterize faces;
    the component also has to lie above the neck in this pinned morphology.
    glTF UV +v is image-down (the exporter already flipped OBJ coordinates).
    """
    material_id, _ = glb.material(BODY)
    candidates = [p for mesh in glb.doc["meshes"] for p in mesh["primitives"] if p.get("material") == material_id]
    require(len(candidates) == 1, "Expected one body primitive")
    p = candidates[0]
    uv = glb.array(p["attributes"]["TEXCOORD_0"])
    position = glb.array(p["attributes"]["POSITION"])
    faces = glb.array(p["indices"]).reshape(-1, 3)
    require(int(faces.max()) < len(uv), "Out-of-range UV index")
    _, labels = np.unique(uv, axis=0, return_inverse=True)
    parent = list(range(int(labels.max()) + 1))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for face in faces:
        ids = labels[face]
        for item in ids[1:]:
            parent[find(int(item))] = find(int(ids[0]))
    groups: dict[int, list] = {}
    for face in faces:
        groups.setdefault(find(int(labels[face[0]])), []).append(face)
    seed = (round(.85 * (size[0] - 1)), round(.50 * (size[1] - 1)))
    matches = []
    for group in groups.values():
        mask = Image.new("L", size)
        draw = ImageDraw.Draw(mask)
        for face in group:
            draw.polygon([tuple(point) for point in uv[face] * (np.array(size) - 1)], fill=255)
        if mask.getpixel(seed):
            require(float(position[np.unique(group), 1].min()) > 1.59, "Seed touched a non-head UV island")
            matches.append(mask)
    require(len(matches) == 1, "Expected exactly one face UV component")
    return np.asarray(matches[0]) > 0


def author_maps(source: np.ndarray, previous: np.ndarray, garment: np.ndarray,
                weight: np.ndarray, head: np.ndarray) -> tuple[dict[str, bytes], dict]:
    require(not np.any(head & garment), "Head restoration intersects the garment")
    # Preserve source hair/brows/skin only in the real head UV island plus a
    # four-texel sampling gutter. The rest remains v9's guide-free donor skin.
    halo = np.asarray(Image.fromarray(np.uint8(head) * 255).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255
    halo[head] = 1
    halo[weight > 0] = 0
    restored = previous.astype(np.float32) * (1 - halo[..., None]) + source * halo[..., None]
    height, width = garment.shape
    y, x = np.indices((height, width), dtype=np.float32)
    rng = np.random.default_rng(10001)
    grain = rng.normal(0, 1, (height, width)).astype(np.float32)
    # Textile detail is authored independently of the guide artwork. It is not
    # displacement, a simulated garment, a scan, or an anatomical measurement.
    weave = np.sin(x * np.pi / 2) * np.sin(y * np.pi / 2)
    cloth = np.stack([np.clip(base + grain * .45, 0, 255) for base in (29., 33., 37.)], axis=-1)
    out_rgb = restored * (1 - weight[..., None]) + cloth * weight[..., None]
    diffuse = image_bytes(np.clip(np.rint(out_rgb), 0, 255), "JPEG")

    # Core glTF: roughness is LINEAR G, metallic is LINEAR B. Factors multiply
    # these texels. Body roughnessFactor must remain 1, not the old studio .64.
    roughness = (.63 + grain * .008) * (1 - weight) + (.94 + weave * .025) * weight
    mr = np.zeros((height, width, 3), dtype=np.uint8)
    mr[..., 0] = 255  # not bound as ambient occlusion
    mr[..., 1] = np.uint8(np.clip(np.rint(roughness * 255), 0, 255))

    # No normal detail derived from albedo: that was how guide lines leaked in.
    # Quantized unit tangent-space normals are PNG, never lossy JPEG.
    detail_height = .045 * weave
    gy, gx = np.gradient(detail_height)
    gx, gy = gx * weight, gy * weight
    normals = np.stack((-gx, gy, np.ones_like(gx)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    normal = np.uint8(np.clip(np.rint((normals * .5 + .5) * 255), 0, 255))
    decoded = np.asarray(Image.open(io.BytesIO(diffuse)).convert("RGB"), dtype=np.float32) / 255
    r, g, b = np.moveaxis(decoded, -1, 0)
    orange = (r > .50) & (g > .12) & (g < .62) & (b < .22) & (decoded.max(-1) - decoded.min(-1) > .28)
    residual = int((orange & garment).sum())
    require(residual == 0, "Guide-colored pixels returned inside the garment")
    # Numeric restoration checks complement, but do not replace, face review.
    head_mae = float(np.abs(decoded[head] * 255 - source[head]).mean())
    require(head_mae < 3, "Head restoration differs from its verified source")
    files = {
        "gyms-v10-head-and-fabric.jpg": diffuse,
        "body-linear-metallic-roughness.png": image_bytes(mr, "PNG"),
        "body-textile-normal.png": image_bytes(normal, "PNG"),
        "restored-head-mask.png": image_bytes(np.uint8(head) * 255, "PNG"),
    }
    return files, {
        "head_source_mean_absolute_error_0_255": head_mae,
        "head_texels": int(head.sum()), "garment_guide_pixels_after_jpeg": residual,
        "garment_roughness_range": [int(mr[..., 1][garment].min()) / 255, int(mr[..., 1][garment].max()) / 255],
        "normal_encoding": "lossless PNG; tangent-space; not generated from albedo",
        "roughness_encoding": "linear green; metallic blue is zero; factor must be one",
    }


def build(baseline: Path, out: Path) -> dict:
    baseline, out = baseline.resolve(), out.resolve()
    require(not out.exists(), "Output already exists; refuse mixed review evidence")
    raw = (baseline / "gyms-digital-human-v9.glb").read_bytes()
    require(sha(raw) in V9_HASHES, "Unreviewed v9 baseline; explicit re-pin and audit required")
    glb = Glb(raw)
    original = copy.deepcopy(glb.doc)
    original_payloads = list(glb.payloads)
    source = pinned_image(baseline / "exported-diffuse-before.png", "RGB", SOURCE_RGB_SHA)
    garment = pinned_image(baseline / "garment-mask.png", "L", GARMENT_L_SHA) > 0
    weight = 1 - pinned_image(baseline / "donor-skin-mask.png", "L", WEIGHT_L_SHA).astype(np.float32) / 255
    _, body = glb.material(BODY)
    _, eyes = glb.material(EYES)
    body_pbr = body["pbrMetallicRoughness"]
    body_image = glb.image_index(body_pbr["baseColorTexture"])
    normal_image = glb.image_index(body["normalTexture"])
    eye_image = glb.image_index(eyes["pbrMetallicRoughness"]["baseColorTexture"])
    previous = np.asarray(Image.open(io.BytesIO(glb.image_bytes(body_image))).convert("RGB"))
    head = head_island(glb, (2048, 2048))
    files, diagnostics = author_maps(source, previous, garment, weight, head)
    glb.replace_image(body_image, files["gyms-v10-head-and-fabric.jpg"], "image/jpeg", "gyms-v10-head-and-fabric")
    glb.replace_image(normal_image, files["body-textile-normal.png"], "image/png", "body-textile-normal")
    sampler = glb.doc["textures"][body_pbr["baseColorTexture"]["index"]]["sampler"]
    mr = glb.add_texture(files["body-linear-metallic-roughness.png"], "image/png", "body-linear-metallic-roughness", sampler)
    body_pbr.update(roughnessFactor=1.0, metallicFactor=0.0, metallicRoughnessTexture={"index": mr})
    body["normalTexture"]["scale"] = .55
    # A single existing eye material: reduce glassy highlights, not a claim of
    # separate cornea/sclera optics or physiological eye reconstruction.
    eyes["pbrMetallicRoughness"].update(roughnessFactor=.38, metallicFactor=0.0)
    glb.doc["asset"]["generator"] = "GYMS.LIFE v10 material review, derived from pinned v9/obj2gltf"
    glb.doc["asset"]["extras"] = {"visualGatePassed": False, "productionEligible": False, "personalScan": False}
    candidate = glb.encode()
    reread = Glb(candidate)
    # Repacking is allowed to move bufferViews, never alter an accessor payload,
    # mesh, transform, UV or index. The independent audit checks them again.
    geometry_views = {a["bufferView"] for a in original["accessors"]}
    require(all(reread.payloads[i] == original_payloads[i] for i in geometry_views), "Geometry bytes changed")
    for key in ("accessors", "meshes", "nodes", "scenes", "scene", "skins", "animations"):
        require(reread.doc.get(key) == original.get(key), f"Structural change: {key}")
    require(reread.image_bytes(eye_image) == original_payloads[original["images"][eye_image]["bufferView"]], "Eye diffuse changed")
    require(len(candidate) <= BUDGET, "Review transfer budget exceeded")
    require(reread.image_bytes(body_image) == files["gyms-v10-head-and-fabric.jpg"], "Wrong embedded diffuse")
    for image in reread.doc["images"]:
        with Image.open(io.BytesIO(reread.payloads[image["bufferView"]])) as decoded:
            decoded.load()
            require(Image.MIME[decoded.format] == image["mimeType"], "Embedded MIME mismatch")
    manifest = {
        "name": "GYMS.LIFE Digital Human v10 MATERIAL-ONLY review candidate",
        "parent_v9_sha256": sha(raw), "asset_sha256": sha(candidate), "asset_bytes": len(candidate),
        "upstream_revision": "06e129ac920593f9f315e03d6d5b3f843504de7f",
        "graphical_assets_license": "CC0-1.0 derivative; no authoring application code included in GLB",
        "license_source": "https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html",
        "source_decoded_rgb_sha256": SOURCE_RGB_SHA,
        "garment_decoded_mask_sha256": GARMENT_L_SHA,
        "donor_weight_decoded_mask_sha256": WEIGHT_L_SHA,
        "texture_sha256": {name: sha(data) for name, data in files.items()},
        "geometry_buffer_sha256": {str(i): sha(reread.payloads[i]) for i in sorted(geometry_views)},
        "geometry_unchanged": True, "separate_garment_shells": 0,
        "head_restore_basis": "actual seeded head UV component; original verified face/brows/hair",
        "diagnostics": diagnostics,
        "visualGatePassed": False, "productionEligible": False,
        "personal_scan": False, "identity_claim": False,
        "remaining_gates": [
            "Independent texture/geometry audit and Khronos validation of these exact bytes",
            "Legacy and authored-material renders under unchanged lights/cameras",
            "Human review: face, eyes, neck transition, fabric, collar, fingers",
            "Runtime material/region/fallback checks and physical-device measurements",
            "Owner visual acceptance and a separate current-main integration",
        ],
        "known_limits": [
            "Texture hair only, no new hair geometry; no SSS/rig/animation introduced",
            "Inherited angular fingertips and collar shape are not corrected in this slice",
            "A textile normal/roughness response is not a simulated garment",
            "Retained missing-tangent warning must be reviewed in the actual renderer",
            "Transfer byte budget is not a measured mobile performance result",
        ],
    }
    # Write only to a new directory after all in-memory checks succeeded.
    out.mkdir(parents=True, exist_ok=False)
    for name, contents in files.items():
        (out / name).write_bytes(contents)
    (out / "gyms-digital-human-v10.glb").write_bytes(candidate)
    (out / "SOURCE_MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--v9", required=True, type=Path, help="Verified v9 build/review directory")
    parser.add_argument("--out", required=True, type=Path, help="New review output directory")
    args = parser.parse_args()
    result = build(args.v9, args.out)
    print(json.dumps({k: result[k] for k in ("asset_sha256", "asset_bytes", "geometry_unchanged", "visualGatePassed", "productionEligible")}))


if __name__ == "__main__":
    main()
