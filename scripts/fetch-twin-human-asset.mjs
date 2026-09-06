import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_COMMIT = "f641c2d612554d3f8f3b7ee162d4561e75976afa";
const SOURCE_PATH = "public/avatars/parametric-base.glb";
const EXPECTED_GIT_BLOB_SHA1 = "652ee3882097d41e7920c7de0454e1c73a94a507";
const EXPECTED_SIZE = 6_806_984;
const SOURCE_URL = `https://raw.githubusercontent.com/nirholas/three.ws/${SOURCE_COMMIT}/${SOURCE_PATH}`;
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
      signal: AbortSignal.timeout(45_000),
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
