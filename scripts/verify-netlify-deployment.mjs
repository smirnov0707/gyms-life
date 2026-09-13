import { readFile, stat } from "node:fs/promises";
import { inspectProductionDeployMetadata } from "./netlify-deployment.checks.mjs";

const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error(
    "Usage: node scripts/verify-netlify-deployment.mjs <snapshot.json> <site-id> <deploy-id>",
  );
  process.exitCode = 1;
} else {
  try {
    const [file, siteId, deployId] = args;
    const info = await stat(file);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error("METADATA_FILE_INVALID");
    const snapshot = JSON.parse(await readFile(file, "utf8"));
    const report = inspectProductionDeployMetadata(snapshot, { siteId, deployId });
    console.log(JSON.stringify(report));
    if (!report.ok) process.exitCode = 1;
  } catch {
    console.error("FAIL metadata-file-unreadable-or-invalid");
    process.exitCode = 1;
  }
}
