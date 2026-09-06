import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_COMMIT = "3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91";
const SOURCE_PATH = "packages/assets/library/human.glb";
const EXPECTED_GIT_BLOB_SHA1 = "2569fa67af8c0acd786d79bcdac9cce6684e0085";
const EXPECTED_SIZE = 2_767_576;
const SOURCE_URL = `https://raw.githubusercontent.com/kunalkushwaha/vsim/${SOURCE_COMMIT}/${SOURCE_PATH}`;
const DESTINATION = resolve("public/models/twin-human.glb");

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`);
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

function verify(bytes) {
  return bytes.byteLength === EXPECTED_SIZE && gitBlobSha1(bytes) === EXPECTED_GIT_BLOB_SHA1;
}

async function existingAssetIsValid() {
  try {
    return verify(await readFile(DESTINATION));
  } catch {
    return false;
  }
}

async function main() {
  if (await existingAssetIsValid()) {
    console.log("Twin human asset already present and verified.");
    return;
  }

  await mkdir(dirname(DESTINATION), { recursive: true });
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "user-agent": "gyms-life-build" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!verify(bytes)) {
      throw new Error(
        `Asset integrity mismatch: received ${bytes.byteLength} bytes / ${gitBlobSha1(bytes)}.`,
      );
    }

    await writeFile(DESTINATION, bytes);
    console.log(`Twin human asset verified and written (${bytes.byteLength} bytes).`);
  } catch (error) {
    await rm(DESTINATION, { force: true }).catch(() => undefined);
    // Photoreal is enhancement-only. Build stays healthy and runtime falls back
    // to the canonical schematic Twin if the pinned upstream asset is unavailable.
    console.warn(`Twin human asset unavailable; schematic fallback will be used. ${String(error)}`);
  }
}

await main();
