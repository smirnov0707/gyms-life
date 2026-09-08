#!/usr/bin/env node
/** Authored-material companion to, never a replacement for, the v8 comparison. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const legacyPreset =
  "m.metalness=0;const n=(m.name||'').toLowerCase();if(n.includes('eye')){m.roughness=.12;m.envMapIntensity=1.55}else{m.roughness=.64;m.envMapIntensity=.40;if(m.normalMap)m.normalScale?.set(.18,.18)}m.needsUpdate=true";
const nativePreset = "m.needsUpdate=true";
const digest = (data) => createHash("sha256").update(data).digest("hex");

export function authoredWorkflow(source) {
  if (source.split(legacyPreset).length !== 2) {
    throw new Error("Expected exactly one known v8 material preset; review scene drift");
  }
  return source.replace(legacyPreset, nativePreset);
}

async function run() {
  if (process.argv[2] === "--self-test") {
    const fixture = `unchanged lights\n${legacyPreset}\nunchanged cameras`;
    assert.equal(authoredWorkflow(fixture), `unchanged lights\n${nativePreset}\nunchanged cameras`);
    assert.throws(() => authoredWorkflow("no preset"), /exactly one/);
    assert.throws(() => authoredWorkflow(fixture + legacyPreset), /exactly one/);
    console.log("3 material-mode transformation checks passed.");
    return;
  }
  if (process.argv.length !== 4) {
    throw new Error(
      "Usage: node scripts/human/render-material-review.mjs MODEL.glb NEW_OUTPUT_DIR",
    );
  }
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const model = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3]);
  const runnerPath = "scripts/human/render-review.mjs";
  const workflowPath = ".github/workflows/human-cc0-render-v8.yml";
  const runner = await readFile(path.join(repo, runnerPath), "utf8");
  const legacy = await readFile(path.join(repo, workflowPath), "utf8");
  const authored = authoredWorkflow(legacy);
  // Copy the SAME runner, changing only the one explicitly identified material
  // preset in its temporary workflow input. No duplicated cameras/lights/renderer.
  const isolated = await mkdtemp(path.join(tmpdir(), "gyms-authored-review-"));
  try {
    await mkdir(path.join(isolated, "scripts/human"), { recursive: true });
    await mkdir(path.join(isolated, ".github/workflows"), { recursive: true });
    await writeFile(path.join(isolated, runnerPath), runner);
    await writeFile(path.join(isolated, workflowPath), authored);
    const result = spawnSync(
      process.execPath,
      [path.join(isolated, runnerPath), model, out, "--dependencies", repo, "--extra-full-body"],
      { stdio: "inherit", timeout: 600000 },
    );
    if (result.error || result.status !== 0) {
      throw new Error(`Authored review failed: ${result.error || result.signal || result.status}`);
    }
    const manifestPath = path.join(out, "review-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    // Canonical here refers to inherited viewing angles, NOT old material
    // settings. Remove the temporary-workflow labels rather than misattribute it.
    manifest.effectiveStudioSha256 = manifest.canonicalStudioSha256;
    delete manifest.canonicalStudioSha256;
    delete manifest.canonicalWorkflow;
    delete manifest.canonicalWorkflowSha256;
    Object.assign(manifest, {
      comparisonMode: "authored-materials",
      legacyMaterialComparison: false,
      sourceRunner: runnerPath,
      sourceRunnerSha256: digest(runner),
      sourceWorkflow: workflowPath,
      sourceWorkflowSha256: digest(legacy),
      authoredWorkflowSha256: digest(authored),
      removedMaterialPresetSha256: digest(legacyPreset),
      lightsAndCamerasUnchanged: true,
      note: "Same v8 lights/cameras; material overrides removed. Compare v9/v10 in this same mode. This is not a production-runtime render.",
      visualGatePassed: false,
      productionEligible: false,
    });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const metricsPath = path.join(out, "metrics.json");
    const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
    metrics.comparisonMode = "authored-materials";
    metrics.legacyMaterialComparison = false;
    for (const reading of metrics.metrics) {
      reading.referenceCamera = reading.canonical;
      delete reading.canonical;
    }
    await writeFile(metricsPath, JSON.stringify(metrics, null, 2) + "\n");
    console.log("Authored-material capture complete; visual and production approval remain false.");
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
}

await run();
