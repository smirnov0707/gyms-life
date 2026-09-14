import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

const positiveInteger = (value) => Number.isInteger(value) && value > 0;
const dimensionsValid = (value) =>
  Array.isArray(value) && value.length === 2 && value.every(positiveInteger);

/**
 * Expand an evidence snapshot, not a runtime media provider.
 * This function makes no network requests and never approves a replacement.
 * Null movement/origin fields are deliberate: filenames are not evidence.
 */
export function buildRegistry(audit) {
  requireThat(audit?.schema_version === 1, "Unsupported audit schema.");
  requireThat(/^[a-f0-9]{40}$/.test(audit.source_commit), "Invalid source commit.");
  requireThat(Array.isArray(audit.catalog), "Missing catalogue.");
  requireThat(audit.catalog.length === audit.catalog_count, "Catalogue count mismatch.");
  const slugs = new Set();
  for (const row of audit.catalog) {
    requireThat(Array.isArray(row) && row.length === 3, "Invalid catalogue row.");
    requireThat(row.every((value) => typeof value === "string" && value.length > 0),
      "Catalogue values must be nonempty strings.");
    requireThat(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row[0]), "Unsafe exercise slug.");
    requireThat(!slugs.has(row[0]), "Duplicate exercise slug.");
    slugs.add(row[0]);
  }
  const digest = createHash("md5")
    .update(audit.catalog.map((row) => row.join("|")).join("\n")).digest("hex");
  requireThat(digest === audit.catalog_md5, "Catalogue differs from observed database digest.");
  const slugDigest = createHash("sha256")
    .update([...slugs].sort().join("\n") + "\n").digest("hex");
  requireThat(slugDigest === audit.catalog_sorted_slugs_sha256,
    "Catalogue differs from observed frame-folder slug set.");
  const measurements = audit.frame_measurements;
  requireThat(measurements?.both_frames_have_same_dimensions === true,
    "This snapshot requires separately measured equal-size frame pairs.");
  requireThat(measurements.observed_file_count === slugs.size * 2 &&
    measurements.decoded_header_count === slugs.size * 2, "Incomplete frame inventory.");
  requireThat(dimensionsValid(measurements.measured_dimensions_for_all_other_listed_slugs),
    "Invalid measured frame dimensions.");
  requireThat(measurements.measured_exceptions &&
    typeof measurements.measured_exceptions === "object", "Missing measured exceptions.");
  for (const [slug, dimensions] of Object.entries(measurements.measured_exceptions)) {
    requireThat(slugs.has(slug) && dimensionsValid(dimensions), "Invalid frame exception.");
  }
  const verification = audit.verification;
  requireThat(verification?.approved_for_replacement === false &&
    verification.exact_movement_verified === false &&
    verification.commercial_use_permission === "unverified" &&
    verification.self_host_permission === "unverified" &&
    Array.isArray(verification.license_evidence) && verification.license_evidence.length === 0,
    "This evidence-only baseline cannot certify movement or permission.");
  requireThat(Array.isArray(audit.videos), "Missing video inventory.");
  const bySlug = new Map();
  const paths = new Set();
  for (const video of audit.videos) {
    requireThat(typeof video.path === "string" &&
      /^public\/assets\/(?:videos|exdb)\/[a-z0-9-]+\.mp4$/.test(video.path),
      "Only existing local asset paths belong in this snapshot.");
    requireThat(!paths.has(video.path), "Duplicate video asset.");
    paths.add(video.path);
    requireThat(dimensionsValid([video.width, video.height]) &&
      positiveInteger(video.size_bytes) &&
      Number.isFinite(video.fps) && video.fps > 0 &&
      Number.isFinite(video.duration_seconds) && video.duration_seconds > 0,
      "Invalid video measurements.");
    requireThat(/^[a-f0-9]{64}$/.test(video.sha256), "Invalid asset checksum.");
    requireThat(Array.isArray(video.review_flags), "Missing content-review flags.");
    if (video.mapped_slug === null) continue;
    requireThat(slugs.has(video.mapped_slug) && !bySlug.has(video.mapped_slug),
      "Unknown or duplicate video mapping.");
    bySlug.set(video.mapped_slug, video);
  }
  const entries = audit.catalog.map(([slug, expectedMovement, equipment]) => {
    const dimensions = measurements.measured_exceptions[slug] ??
      measurements.measured_dimensions_for_all_other_listed_slugs;
    const frames = [0, 1].map((index) => ({
      path: `public/assets/exercise-db/${slug}/${index}.jpg`,
      width: dimensions[0], height: dimensions[1], codec: measurements.codec,
      file_status_at_snapshot: "present_and_header_decoded",
      visual_review_status: "not_reviewed",
    }));
    const video = bySlug.get(slug) ?? null;
    return {
      slug,
      expected_movement_from_catalog: expectedMovement,
      expected_equipment_from_catalog: equipment,
      exact_movement_represented: null,
      current_selection: video ? { type: "video", path: video.path } :
        { type: "frames", paths: frames.map((frame) => frame.path) },
      current_video: video,
      frames,
      original_creator: null,
      original_source: null,
      upload_provenance: "Present in the existing repository; original uploader not established.",
      filmed_human_origin: video?.filmed_human_origin ?? "unverified",
      observed_content_lt: video?.observed_content_lt ?? null,
      content_review_status: video ? "sampled_frames_only" : "not_reviewed",
      review_flags: video?.review_flags ?? ["no_direct_video", "frame_content_not_reviewed"],
      commercial_use_permission: "unverified",
      self_host_permission: "unverified",
      license_evidence: [],
      performer_release_evidence: [],
      approved_for_replacement: false,
      deployment_status: "not_checked",
      evidence: { date: audit.audit_date, source_commit: audit.source_commit },
    };
  });
  const unmatched = audit.videos.filter((video) => video.mapped_slug === null);
  return {
    schema_version: 1,
    audit_date: audit.audit_date,
    source_commit: audit.source_commit,
    summary: {
      catalog_exercises: entries.length,
      direct_video_assignments: bySlug.size,
      frame_only_assignments: entries.length - bySlug.size,
      frame_files_present_at_snapshot: measurements.observed_file_count,
      full_hd_direct_video_assignments: [...bySlug.values()]
        .filter((video) => video.width >= 1920 && video.height >= 1080).length,
      unassigned_video_assets: unmatched.length,
      approved_for_replacement: 0,
    },
    entries,
    unassigned_video_assets: unmatched,
    limitations: audit.limitations,
  };
}

async function main() {
  const input = process.argv[2] ?? fileURLToPath(new URL("./exercise-media-audit-20260914.json", import.meta.url));
  const output = process.argv[3] ?? resolve("exercise-media-registry-20260914.json");
  requireThat(resolve(input) !== resolve(output), "Input and output must be different files.");
  const audit = JSON.parse(await readFile(input, "utf8"));
  const registry = buildRegistry(audit);
  // Exclusive write: a rerun must not silently overwrite reviewed work.
  await writeFile(output, JSON.stringify(registry, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(registry.summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Registry build failed.");
    process.exitCode = 1;
  });
}
