import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pilot = JSON.parse(await readFile(new URL("./free-media-pilot-20260914.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("./exercise-media-audit-20260914.json", import.meta.url), "utf8"));
const slugs = new Set(baseline.catalog.map((row) => row[0]));

test("budget excludes filming, subscriptions and paid generation", () => {
  assert.deepEqual(pilot.constraints, {media_license_budget_eur:0,paid_subscriptions_allowed:false,new_filming_allowed:false,paid_generation_allowed:false});
});
test("all 25 free-download titles are unique and classified", () => {
  assert.equal(pilot.selection.length, 25);
  assert.equal(new Set(pilot.selection.map((row) => row[0])).size, 25);
  const counts = {};
  for (const row of pilot.selection) counts[row[2]] = (counts[row[2]] ?? 0) + 1;
  assert.deepEqual(counts, pilot.selection_counts);
  assert.deepEqual(counts, {name_equipment_candidate:12,variant_review_required:5,not_mapped:8});
});
test("leads reference distinct existing catalogue entries, never new exercises", () => {
  assert.equal(slugs.size, 175);
  const targets = pilot.selection.filter((row) => row[1] !== null).map((row) => row[1]);
  assert.equal(targets.length, new Set(targets).size);
  for (const slug of targets) assert.ok(slugs.has(slug));
  for (const row of pilot.selection) assert.equal(row[2] === "not_mapped", row[1] === null);
});
test("free clips do not claim to replace the audited lunge or burpee", () => {
  assert.ok(!pilot.selection.some((row) => ["lunge", "burpee"].includes(row[1])));
  assert.equal(pilot.state.confirmed_175_exercise_video_coverage, false);
});
test("three measured samples use the real free-download route, not hero footage", () => {
  assert.equal(pilot.measured_samples.length, 3);
  for (const sample of pilot.measured_samples) {
    assert.match(sample.source_url, /^https:\/\/ymove\.app\/api\/free\/[a-f0-9-]{36}$/);
    assert.ok(pilot.selection.some((row) => row[0] === sample.provider_title && row[1] === sample.gyms_slug));
    assert.deepEqual([sample.width,sample.height,sample.fps,sample.codec], [720,1280,25,"h264"]);
    assert.match(sample.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sample.visible_brand_mark, "your move.");
    assert.equal(sample.final_technique_approval, false);
  }
});
test("RepDB remains a labelled static alternative with no coverage claim", () => {
  assert.equal(pilot.static_fallback_candidate.catalog_coverage, "not_checked");
  assert.equal(pilot.static_fallback_candidate.approved_assets, 0);
  assert.match(pilot.static_fallback_candidate.format, /NOT video/);
  assert.match(pilot.static_fallback_candidate.origin, /NOT photographs/);
  assert.match(pilot.static_fallback_candidate.restrictions.join(" "), /No generative-AI/);
});
test("sourcing research cannot imply a paid service, runtime import or release", () => {
  assert.equal(pilot.state.production_changed, false);
  assert.equal(pilot.state.new_video_assets_imported_into_app, 0);
  assert.equal(pilot.state.new_paid_service_started, false);
});
