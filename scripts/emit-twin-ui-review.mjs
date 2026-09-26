/** Lossless screenshots of the synthetic CI fixture for visual inspection. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const asset = await readFile("public/models/twin-selected-v1.glb");
const assetSha256 = createHash("sha256").update(asset).digest("hex");
if (assetSha256 !== "e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31")
  throw new Error("Selected model differs from the confirmed baseline");

for (const name of [
  "reference-today-1280x853",
  "reference-today-mobile-viewport",
  "reference-twin-desktop-viewport",
  "reference-twin-mobile-viewport",
  "reference-muscle-desktop-viewport",
  "reference-muscle-mobile-viewport",
  "reference-futureme-desktop-viewport",
  "reference-futureme-mobile-viewport",
  "reference-lab-desktop-viewport",
  "reference-lab-mobile-viewport",
  "reference-journal-desktop-viewport",
  "reference-journal-mobile-viewport",
  "reference-coach-desktop-viewport",
  "reference-coach-mobile-viewport",
  "design-today-light-1440",
  "design-lab-light-390",
  "design-twin-light-390",
  "design-coach-light-390",
  "design-coach-dark-1440",
  "design-actions-light-390",
]) {
  const bytes = await readFile(`test-results/today/${name}.png`);
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Preview exceeds bounded log size");
  console.log(
    "TWIN_UI_BEGIN " +
      JSON.stringify({
        name,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        assetSha256,
        syntheticFixture: true,
      }),
  );
  const encoded = bytes.toString("base64");
  for (let i = 0; i < encoded.length; i += 4096)
    console.log("TWIN_UI_CHUNK " + encoded.slice(i, i + 4096));
  console.log("TWIN_UI_END " + name);
}
