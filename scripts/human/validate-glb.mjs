#!/usr/bin/env node
/** Official Khronos validation bound to the exact candidate bytes. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length !== 2 || args.includes("--help")) {
  console.log("Usage: node scripts/human/validate-glb.mjs MODEL.glb REPORT.json");
  process.exit(args.includes("--help") ? 0 : 1);
}
const modelPath = path.resolve(args[0]);
const reportPath = path.resolve(args[1]);
const bytes = await readFile(modelPath);
const { default: validator } = await import("./toolchain/node_modules/gltf-validator/index.js");
const version = validator.version();
if (version !== "2.0.0-dev.3.10") throw new Error(`Unexpected validator version: ${version}`);

// The unchanged v8 body does not have baked tangents. Retain this official
// warning in full, narrowly scoped to that body's normal-mapped primitive.
// It is acceptable for an isolated review candidate, not production approval.
const reviewedWarning = {
  code: "MESH_PRIMITIVE_GENERATED_TANGENT_SPACE",
  pointer: "/meshes/0/primitives/0/material",
  reason:
    "The inherited body has UVs and normals but no baked tangents. Runtime tangent generation must be reviewed in the actual renderer before production; retaining this warning avoids silently changing the v8 comparison geometry.",
};
const report = {
  reportVersion: 1,
  scope: "official_khronos_gltf_validation",
  asset: {
    filename: path.basename(modelPath),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  },
  validator: {
    package: "gltf-validator",
    version,
    source: "https://github.com/KhronosGroup/glTF-Validator",
  },
  policy: {
    errors: "fail",
    warnings: "fail except the single explicitly reviewed body tangent-space warning",
    reviewedWarning,
    issueSeveritiesOverridden: false,
    issuesSuppressed: false,
    externalResources: "reject; no network or filesystem resource resolution",
  },
  validationPassed: false,
  visualAcceptance: "not_assessed",
  productionEligible: false,
  remainingGates: [
    "Exact authored-texture and v8 geometry fingerprint audit",
    "Multi-angle visual review of the exact asset",
    "Runtime-generated tangent-space portability review in the actual renderer",
    "Region picking, fallback, lifecycle and physical mobile performance checks",
    "Owner visual acceptance and separate reviewed production integration",
  ],
};
try {
  const result = await validator.validateBytes(new Uint8Array(bytes), {
    uri: path.basename(modelPath),
    format: "glb",
    writeTimestamp: false,
    maxIssues: 1000,
    externalResourceFunction: async (uri) => {
      throw new Error(`External resources are forbidden in a self-contained review GLB: ${uri}`);
    },
  });
  report.khronos = result;
  const issues = result.issues;
  const warnings = issues.messages.filter((issue) => issue.severity === 1);
  const unreviewedWarnings = warnings.filter(
    (issue) => issue.code !== reviewedWarning.code || issue.pointer !== reviewedWarning.pointer,
  );
  report.unreviewedWarnings = unreviewedWarnings;
  report.validationPassed =
    issues.numErrors === 0 &&
    issues.truncated === false &&
    issues.numWarnings === warnings.length &&
    warnings.length <= 1 &&
    unreviewedWarnings.length === 0;
  report.status = report.validationPassed
    ? warnings.length > 0
      ? "passed_with_review_warning"
      : "passed_without_warnings"
    : "failed";
} catch (error) {
  report.status = "failed";
  report.error = String(error);
}
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(
  JSON.stringify({
    report: reportPath,
    assetSha256: report.asset.sha256,
    status: report.status,
    errors: report.khronos?.issues.numErrors ?? null,
    warnings: report.khronos?.issues.numWarnings ?? null,
    productionEligible: false,
  }),
);
process.exitCode = report.validationPassed ? 0 : 2;
