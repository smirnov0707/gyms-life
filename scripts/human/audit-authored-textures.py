#!/usr/bin/env python3
"""Exact-file offline audit for a texture-only successor to the v8 body + eyes.

This is neither the Khronos validator nor visual approval. Requires Pillow.
"""
import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_glb(path):
    raw = path.read_bytes()
    require(len(raw) >= 20, "GLB header truncated")
    magic, version, size = struct.unpack_from("<4sII", raw)
    require(magic == b"glTF" and version == 2 and size == len(raw), "Invalid GLB header")
    cursor, chunks = 12, []
    while cursor < len(raw):
        require(cursor + 8 <= len(raw), "Truncated chunk header")
        length, kind = struct.unpack_from("<II", raw, cursor)
        cursor += 8
        require(length % 4 == 0 and cursor + length <= len(raw), "Invalid chunk range")
        chunks.append((kind, raw[cursor:cursor + length]))
        cursor += length
    require(len(chunks) == 2 and [x[0] for x in chunks] == [0x4E4F534A, 0x004E4942], "Expected JSON and BIN chunks")
    doc = json.loads(chunks[0][1])
    binary = chunks[1][1]
    require(doc.get("asset", {}).get("version") == "2.0", "Unsupported glTF asset version")
    require(len(doc.get("buffers", [])) == 1 and "uri" not in doc["buffers"][0], "Buffer must be embedded")
    declared = doc["buffers"][0]["byteLength"]
    require(0 <= len(binary) - declared <= 3, "Invalid declared buffer size")
    require(not doc.get("extensionsUsed") and not doc.get("extensionsRequired"), "Extensions require separate decoder review")
    binary = binary[:declared]
    for view in doc.get("bufferViews", []):
        start, length = view.get("byteOffset", 0), view["byteLength"]
        require(view.get("buffer", 0) == 0 and start >= 0 and length >= 0 and start + length <= len(binary), "Buffer view out of bounds")
    return raw, doc, binary


def view_bytes(doc, binary, index):
    require(isinstance(index, int) and 0 <= index < len(doc["bufferViews"]), "Invalid buffer view index")
    view = doc["bufferViews"][index]
    start = view.get("byteOffset", 0)
    return binary[start:start + view["byteLength"]]


def accessor(doc, binary, index):
    require(isinstance(index, int) and 0 <= index < len(doc["accessors"]), "Invalid accessor index")
    source = doc["accessors"][index]
    require("sparse" not in source and "bufferView" in source, "Sparse/missing accessors need separate review")
    sizes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
    require(source["componentType"] in sizes and source["type"] in widths, "Unsupported geometry accessor")
    item_size = sizes[source["componentType"]] * widths[source["type"]]
    view = doc["bufferViews"][source["bufferView"]]
    stride = view.get("byteStride", item_size)
    count, offset = source["count"], source.get("byteOffset", 0)
    require(isinstance(count, int) and count > 0 and stride >= item_size and offset >= 0, "Invalid accessor layout")
    require(offset + (count - 1) * stride + item_size <= view["byteLength"], "Accessor outside buffer view")
    contents = view_bytes(doc, binary, source["bufferView"])
    packed = b"".join(contents[offset + i * stride:offset + i * stride + item_size] for i in range(count))
    metadata = {key: source[key] for key in ("componentType", "type", "count")}
    metadata["normalized"] = source.get("normalized", False)
    return {**metadata, "sha256": sha(canonical(metadata) + b"\0" + packed)}, packed


def geometry(doc, binary):
    result, triangles = [], 0
    for mesh in doc.get("meshes", []):
        entries = []
        for primitive in mesh.get("primitives", []):
            require(primitive.get("mode", 4) == 4 and not primitive.get("targets"), "Only static triangle surfaces supported")
            attributes = primitive["attributes"]
            require("POSITION" in attributes and "TEXCOORD_0" in attributes and "indices" in primitive, "Geometry/UV/index data missing")
            hashes = {name: accessor(doc, binary, index)[0] for name, index in sorted(attributes.items())}
            indices, packed = accessor(doc, binary, primitive["indices"])
            require(indices["count"] % 3 == 0 and indices["componentType"] in (5121, 5123, 5125), "Invalid triangle indices")
            require(indices["type"] == "SCALAR", "Index accessor must be scalar")
            fmt = {5121: "B", 5123: "H", 5125: "I"}[indices["componentType"]]
            require(max(value[0] for value in struct.iter_unpack("<" + fmt, packed)) < hashes["POSITION"]["count"], "Index references missing vertex")
            require(all(value["count"] == hashes["POSITION"]["count"] for value in hashes.values()), "Vertex attribute counts differ")
            triangles += indices["count"] // 3
            entries.append({"mode": 4, "attributes": hashes, "indices": indices})
        result.append({"name": mesh.get("name"), "primitives": entries})
    require(result, "No geometry")
    return result, triangles


def inspect(path, body_material):
    raw, doc, binary = load_glb(path)
    meshes, triangles = geometry(doc, binary)
    images = []
    for index, image in enumerate(doc.get("images", [])):
        require("uri" not in image and "bufferView" in image, "Image must be embedded")
        encoded = view_bytes(doc, binary, image["bufferView"])
        with Image.open(io.BytesIO(encoded)) as decoded:
            decoded.load()
            actual_mime = Image.MIME.get(decoded.format)
            require(actual_mime == image.get("mimeType"), "Image MIME does not match decoded bytes")
            images.append({"index": index, "name": image.get("name"), "mimeType": actual_mime, "bytes": len(encoded), "sha256": sha(encoded), "width": decoded.width, "height": decoded.height, "mode": decoded.mode})
    materials = doc.get("materials", [])
    matches = [(i, m) for i, m in enumerate(materials) if m.get("name") == body_material]
    require(len(matches) == 1, "Body material must match exactly once")
    material_index, material = matches[0]
    texture = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
    require(texture is not None and texture.get("texCoord", 0) == 0, "Body diffuse must use UV0")
    image_index = doc["textures"][texture["index"]]["source"]
    require(0 <= image_index < len(images), "Body image missing")
    body_primitives = sum(p.get("material") == material_index for m in doc.get("meshes", []) for p in m["primitives"])
    # Names are export labels (v8/v9), not geometry or scene transforms.
    structure = {key: [{k: v for k, v in item.items() if k not in ("name", "extras")} for item in doc.get(key, [])] for key in ("nodes", "scenes", "skins", "animations")}
    structure["scene"] = doc.get("scene", 0)
    return {"sha256": sha(raw), "bytes": len(raw), "storedTriangles": triangles, "meshCount": len(meshes), "primitiveCount": sum(len(m["primitives"]) for m in meshes), "bodyPrimitives": body_primitives, "bodyImage": images[image_index], "images": images, "geometry": meshes, "geometrySha256": sha(canonical(meshes)), "sceneStructureSha256": sha(canonical(structure)), "skinCount": len(doc.get("skins", [])), "animationCount": len(doc.get("animations", [])), "meshNames": [m["name"] for m in meshes]}


FINGERPRINT_KEYS = (
    "sha256", "storedTriangles", "meshCount", "primitiveCount", "bodyPrimitives",
    "geometry", "geometrySha256", "sceneStructureSha256", "skinCount",
    "animationCount", "meshNames",
)


def export_fingerprint(source, destination, body_material):
    """Persist measured topology only; this file has no visual approval fields."""
    observed = inspect(source, body_material)
    fingerprint = {
        "fingerprintVersion": 1,
        "referenceName": source.name,
        "bodyMaterial": body_material,
        **{key: observed[key] for key in FINGERPRINT_KEYS},
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("x") as handle:
        json.dump(fingerprint, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"fingerprint": str(destination), "referenceSha256": observed["sha256"], "geometrySha256": observed["geometrySha256"]}))


def load_fingerprint(path, body_material):
    fingerprint = json.loads(path.read_text())
    expected = set(FINGERPRINT_KEYS) | {"fingerprintVersion", "referenceName", "bodyMaterial"}
    require(isinstance(fingerprint, dict) and set(fingerprint) == expected, "Unexpected reference fingerprint schema")
    require(fingerprint["fingerprintVersion"] == 1, "Unsupported fingerprint version")
    require(fingerprint["bodyMaterial"] == body_material, "Fingerprint body material differs")
    require(fingerprint["geometrySha256"] == sha(canonical(fingerprint["geometry"])), "Fingerprint geometry digest is inconsistent")
    for key in ("sha256", "geometrySha256", "sceneStructureSha256"):
        digest = fingerprint[key]
        require(isinstance(digest, str) and len(digest) == 64 and all(c in "0123456789abcdef" for c in digest), "Invalid fingerprint SHA256")
    require(fingerprint["meshNames"] == [mesh["name"] for mesh in fingerprint["geometry"]], "Fingerprint mesh identities are inconsistent")
    require(fingerprint["meshCount"] == len(fingerprint["geometry"]), "Fingerprint mesh count is inconsistent")
    return fingerprint


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate", type=Path)
    reference = parser.add_mutually_exclusive_group()
    reference.add_argument("--reference", type=Path)
    reference.add_argument("--reference-fingerprint", type=Path)
    parser.add_argument("--export-fingerprint", type=Path, help="Export reference geometry fingerprint, then exit; no visual acceptance is recorded")
    parser.add_argument("--body-image-sha256")
    parser.add_argument("--body-material", default="young_caucasian_male_detailed")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.export_fingerprint:
        if args.reference or args.reference_fingerprint or args.body_image_sha256 or args.report:
            parser.error("--export-fingerprint is separate from a candidate audit")
        export_fingerprint(args.candidate, args.export_fingerprint, args.body_material)
        return 0
    if not (args.reference or args.reference_fingerprint) or not args.body_image_sha256 or not args.report:
        parser.error("Audit requires --reference or --reference-fingerprint, --body-image-sha256 and --report")
    require(len(args.body_image_sha256) == 64 and all(c in "0123456789abcdef" for c in args.body_image_sha256.lower()), "Expected image hash must be SHA256")
    require(not args.report.exists(), "Refusing to overwrite an audit report")
    report = {"reportVersion": 1, "scope": "exact_texture_and_geometry_comparison", "visualGatePassed": False, "productionEligible": False, "checks": []}
    try:
        baseline = (load_fingerprint(args.reference_fingerprint, args.body_material)
                    if args.reference_fingerprint else inspect(args.reference, args.body_material))
        candidate = inspect(args.candidate, args.body_material)
        report.update({"reference": baseline, "candidate": candidate})
        checks = {
            "expected_embedded_body_diffuse": candidate["bodyImage"]["sha256"] == args.body_image_sha256.lower(),
            "unchanged_geometry_indices_uvs_normals": candidate["geometry"] == baseline["geometry"],
            "unchanged_scene_structure": candidate["sceneStructureSha256"] == baseline["sceneStructureSha256"],
            "single_body_surface_plus_eyes_no_added_garments": candidate["meshNames"] == baseline["meshNames"] == ["base.obj_1", "high-poly.obj_1"] and candidate["primitiveCount"] == baseline["primitiveCount"] == 2 and candidate["bodyPrimitives"] == baseline["bodyPrimitives"] == 1,
            "no_rig_or_animation_added": candidate["skinCount"] == candidate["animationCount"] == 0,
            "all_resources_embedded_and_images_decoded": True,
            "triangle_budget": candidate["storedTriangles"] <= 100000,
            "transfer_budget": candidate["bytes"] <= 8 * 1024 * 1024,
        }
        report["checks"] = [{"id": key, "passed": value} for key, value in checks.items()]
        report["technicalPassed"] = all(checks.values())
    except (ValueError, TypeError, KeyError, IndexError, OSError, struct.error) as error:
        report["technicalPassed"] = False
        report["error"] = str(error)
    report["remainingGates"] = ["Khronos glTF validation", "Identical multi-angle rendered visual review", "Actual runtime region/picking/fallback integration tests", "Physical mobile performance measurement", "Owner visual acceptance before production integration"]
    report["limitations"] = "Unchanged reference geometry proves no garment shell was added; it does not prove the reference is watertight, anatomically correct or free of all self-intersections. No pixels are visually approved by this report."
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with args.report.open("x") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"report": str(args.report), "technicalPassed": report["technicalPassed"], "visualGatePassed": False}))
    return 0 if report["technicalPassed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
