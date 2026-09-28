import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRegistry } from "./build-registry.mjs";

const source = JSON.parse(await readFile(
  new URL("./exercise-media-audit-20260914.json", import.meta.url), "utf8"));
const fresh = () => structuredClone(source);

test("all 175 database entries expand with the observed catalogue digest", () => {
  const registry = buildRegistry(fresh());
  assert.equal(registry.entries.length, 175);
  assert.equal(new Set(registry.entries.map((entry) => entry.slug)).size, 175);
});
test("direct videos, frame-only entries and Full HD are counted separately", () => {
  assert.deepEqual(buildRegistry(fresh()).summary, {
    catalog_exercises: 175, direct_video_assignments: 10,
    frame_only_assignments: 165, frame_files_present_at_snapshot: 350,
    full_hd_direct_video_assignments: 0, unassigned_video_assets: 1,
    approved_for_replacement: 0,
  });
});
test("the unmatched Turkish get-up file is not silently reassigned", () => {
  const registry = buildRegistry(fresh());
  assert.equal(registry.entries.find((entry) => entry.slug === "kb-turkish-get-up")
    .current_selection.type, "frames");
  assert.equal(registry.unassigned_video_assets[0].mapped_slug, null);
});
test("all exact frame paths, including measured exceptions, are explicit", () => {
  const registry = buildRegistry(fresh());
  for (const entry of registry.entries) {
    assert.deepEqual(entry.frames.map((frame) => frame.path), [0, 1]
      .map((index) => `public/assets/exercise-db/${entry.slug}/${index}.jpg`));
  }
  const deadBug = registry.entries.find((entry) => entry.slug === "dead-bug");
  assert.equal(deadBug.frames[0].width, 1280);
  assert.equal(deadBug.frames[0].height, 720);
});
test("sample review never implies exact movement, origin or rights approval", () => {
  for (const entry of buildRegistry(fresh()).entries) {
    assert.equal(entry.exact_movement_represented, null);
    assert.equal(entry.original_creator, null);
    assert.equal(entry.commercial_use_permission, "unverified");
    assert.equal(entry.self_host_permission, "unverified");
    assert.equal(entry.approved_for_replacement, false);
  }
});
test("observed lunge equipment mismatch and incomplete burpee samples persist", () => {
  const entries = buildRegistry(fresh()).entries;
  assert.ok(entries.find((entry) => entry.slug === "lunge")
    .review_flags.includes("observed_equipment_mismatch"));
  assert.ok(entries.find((entry) => entry.slug === "burpee")
    .review_flags.includes("full_cycle_not_demonstrated_in_samples"));
});
test("modified catalogue names cannot inherit the observed database checksum", () => {
  const data = fresh(); data.catalog[0][1] = "Unverified replacement";
  assert.throws(() => buildRegistry(data), /database digest/);
});
test("duplicate exercise slugs are rejected", () => {
  const data = fresh(); data.catalog[1][0] = data.catalog[0][0];
  assert.throws(() => buildRegistry(data), /Duplicate exercise slug/);
});
test("unknown dimension exceptions are rejected", () => {
  const data = fresh(); data.frame_measurements.measured_exceptions.unknown = [100, 100];
  assert.throws(() => buildRegistry(data), /Invalid frame exception/);
});
test("external media links and path traversal are rejected", () => {
  for (const path of ["https://example.org/exercise.mp4", "public/assets/videos/../../secret.mp4"]) {
    const data = fresh(); data.videos[0].path = path;
    assert.throws(() => buildRegistry(data), /local asset paths/);
  }
});
test("invalid video checksums are rejected", () => {
  const data = fresh(); data.videos[0].sha256 = "not-a-checksum";
  assert.throws(() => buildRegistry(data), /Invalid asset checksum/);
});
test("unsupported approval claims cannot be promoted from snapshot input", () => {
  const data = fresh(); data.verification.approved_for_replacement = true;
  assert.throws(() => buildRegistry(data), /cannot certify/);
});
