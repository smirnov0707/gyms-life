"""Executable regression gates; requires V9_REVIEW_DIR, never silently skips."""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("build_v10", Path(__file__).with_name("build-v10.py"))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class MaterialReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        baseline = os.environ.get("V9_REVIEW_DIR")
        if not baseline:
            raise RuntimeError("Set V9_REVIEW_DIR to the verified v9 review/export directory")
        cls.baseline = Path(baseline)
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.out = cls.root / "candidate"
        cls.report = b.build(cls.baseline, cls.out)
        cls.raw = (cls.out / "gyms-digital-human-v10.glb").read_bytes()
        cls.parent = b.Glb((cls.baseline / "gyms-digital-human-v9.glb").read_bytes())
        cls.glb = b.Glb(cls.raw)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def texture(self, key):
        _, material = self.glb.material(b.BODY)
        reference = material.get(key) or material["pbrMetallicRoughness"][key]
        index = self.glb.image_index(reference)
        return np.asarray(Image.open(io.BytesIO(self.glb.image_bytes(index))).convert("RGB"))

    def test_every_geometry_accessor_is_unchanged(self):
        self.assertEqual(self.parent.doc["accessors"], self.glb.doc["accessors"])
        for i in range(len(self.parent.doc["accessors"])):
            np.testing.assert_array_equal(self.parent.array(i), self.glb.array(i))

    def test_scene_is_unchanged_and_has_only_body_and_eyes(self):
        for key in ("meshes", "nodes", "scenes", "scene", "skins", "animations"):
            self.assertEqual(self.parent.doc.get(key), self.glb.doc.get(key))
        self.assertEqual(len(self.glb.doc["meshes"]), 2)
        self.assertEqual(sum(self.glb.doc["accessors"][p["indices"]]["count"] // 3 for m in self.glb.doc["meshes"] for p in m["primitives"]), 28796)

    def test_original_head_and_dark_hair_are_restored(self):
        source = np.asarray(Image.open(self.baseline / "exported-diffuse-before.png").convert("RGB"))
        head = np.asarray(Image.open(self.out / "restored-head-mask.png")) > 0
        rgb = self.texture("baseColorTexture")
        self.assertLess(float(np.abs(rgb[head].astype(float) - source[head]).mean()), 3)
        dark = head & (source.max(-1) < 70)
        self.assertGreater(int(dark.sum()), 10000)
        self.assertGreater(float((rgb[dark].max(-1) < 80).mean()), .98)

    def test_garment_stays_guide_free_after_jpeg(self):
        rgb = self.texture("baseColorTexture") / 255
        r, g, blue = np.moveaxis(rgb, -1, 0)
        orange = (r > .50) & (g > .12) & (g < .62) & (blue < .22) & (rgb.max(-1) - rgb.min(-1) > .28)
        mask = np.asarray(Image.open(self.baseline / "garment-mask.png")) > 0
        self.assertEqual(int((orange & mask).sum()), 0)

    def test_roughness_is_linear_green_and_metallic_is_zero(self):
        mr = self.texture("metallicRoughnessTexture")
        cloth = np.asarray(Image.open(self.baseline / "garment-mask.png")) > 0
        head = np.asarray(Image.open(self.out / "restored-head-mask.png")) > 0
        self.assertEqual(int(mr[..., 2].max()), 0)
        self.assertGreater(float(mr[..., 1][cloth].min()) / 255, .88)
        self.assertLess(float(mr[..., 1][head].mean()) / 255, .70)
        self.assertGreater(float(mr[..., 1][cloth].mean() - mr[..., 1][head].mean()), 60)
        _, material = self.glb.material(b.BODY)
        self.assertEqual(material["pbrMetallicRoughness"]["roughnessFactor"], 1)
        self.assertEqual(material["pbrMetallicRoughness"]["metallicFactor"], 0)

    def test_normals_are_lossless_nearly_unit_and_not_derived_from_albedo(self):
        normal = self.texture("normalTexture") / 255 * 2 - 1
        self.assertLess(float(np.abs(np.linalg.norm(normal, axis=-1) - 1).max()), .01)
        _, material = self.glb.material(b.BODY)
        index = self.glb.image_index(material["normalTexture"])
        self.assertEqual(self.glb.doc["images"][index]["mimeType"], "image/png")
        self.assertTrue(self.glb.image_bytes(index).startswith(b"\x89PNG"))
        self.assertEqual(material["normalTexture"]["scale"], .55)

    def test_eye_diffuse_and_alpha_contract_are_preserved(self):
        _, old = self.parent.material(b.EYES)
        _, new = self.glb.material(b.EYES)
        i = self.parent.image_index(old["pbrMetallicRoughness"]["baseColorTexture"])
        j = self.glb.image_index(new["pbrMetallicRoughness"]["baseColorTexture"])
        self.assertEqual(self.parent.image_bytes(i), self.glb.image_bytes(j))
        self.assertEqual(new["alphaMode"], old["alphaMode"])
        self.assertEqual(new["doubleSided"], old["doubleSided"])
        self.assertEqual(new["pbrMetallicRoughness"]["roughnessFactor"], .38)

    def test_written_bytes_and_embedded_textures_match_manifest(self):
        self.assertEqual(b.sha(self.raw), self.report["asset_sha256"])
        self.assertEqual(len(self.raw), self.report["asset_bytes"])
        self.assertLessEqual(len(self.raw), b.BUDGET)
        for filename, digest in self.report["texture_sha256"].items():
            self.assertEqual(b.sha((self.out / filename).read_bytes()), digest)
        _, mat = self.glb.material(b.BODY)
        for key, filename in [("baseColorTexture", "gyms-v10-head-and-fabric.jpg"), ("metallicRoughnessTexture", "body-linear-metallic-roughness.png")]:
            index = self.glb.image_index(mat["pbrMetallicRoughness"][key])
            self.assertEqual(b.sha(self.glb.image_bytes(index)), self.report["texture_sha256"][filename])

    def test_no_technical_result_grants_visual_or_production_approval(self):
        for data in (self.report, self.glb.doc["asset"]["extras"]):
            self.assertIs(data["visualGatePassed"], False)
            self.assertIs(data["productionEligible"], False)
        self.assertFalse(self.report["personal_scan"])
        self.assertFalse(self.report["identity_claim"])

    def test_existing_evidence_is_not_overwritten(self):
        with self.assertRaisesRegex(ValueError, "already exists"):
            b.build(self.baseline, self.out)
        self.assertEqual((self.out / "gyms-digital-human-v10.glb").read_bytes(), self.raw)

    def test_unreviewed_parent_is_refused_before_output(self):
        bad = self.root / "bad-parent"
        bad.mkdir()
        (bad / "gyms-digital-human-v9.glb").write_bytes(b"not the verified parent")
        destination = self.root / "bad-result"
        with self.assertRaisesRegex(ValueError, "Unreviewed v9"):
            b.build(bad, destination)
        self.assertFalse(destination.exists())

    def test_wrong_source_texture_pin_is_refused(self):
        with self.assertRaisesRegex(ValueError, "Unexpected decoded source"):
            b.pinned_image(self.baseline / "exported-diffuse-before.png", "RGB", "0" * 64)

    def test_truncated_external_and_extension_assets_are_refused(self):
        with self.assertRaises(ValueError):
            b.Glb(self.raw[:-4])
        for mutate in (lambda d: d["images"][0].update(uri="https://example.invalid/texture.png"),
                       lambda d: d.update(extensionsUsed=["KHR_materials_unlit"])):
            instance = b.Glb(self.raw)
            mutate(instance.doc)
            with self.assertRaises(ValueError):
                b.Glb(instance.encode())

    def test_geometry_repack_is_stable(self):
        encoded = self.glb.encode()
        reread = b.Glb(encoded)
        self.assertEqual(reread.encode(), encoded)
        self.assertEqual(reread.payloads, self.glb.payloads)

    def test_head_island_does_not_cover_a_body_region(self):
        head = b.head_island(self.parent, (2048, 2048))
        cloth = np.asarray(Image.open(self.baseline / "garment-mask.png")) > 0
        self.assertFalse(bool(np.any(head & cloth)))
        self.assertGreater(int(head.sum()), 500000)
        altered = b.Glb((self.baseline / "gyms-digital-human-v9.glb").read_bytes())
        altered.doc["meshes"][0]["primitives"][0]["material"] = 1
        with self.assertRaisesRegex(ValueError, "one body"):
            b.head_island(altered, (2048, 2048))


if __name__ == "__main__":
    unittest.main(verbosity=2)
