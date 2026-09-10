import atlas from "../../../public/models/twin-anatomy.manifest.json";

export type TwinBodyProvenance = Readonly<{
  source: "bodyparts3d" | "makehuman";
  credit: string;
  candidate: boolean;
  sha256: string;
}>;

/** Registered bytes, not a URL or self-declared copyright. Registration is not visual approval. */
export const TWIN_REGISTERED_ASSETS = [
  {
    path: "public/models/twin-body-v2.glb",
    source: "bodyparts3d",
    candidate: false,
    sha256: "9c3bcd90d6cd5559efb1c2f166623f711f54d52cc1e93759a9d760bc63843cad",
  },
  {
    path: "public/models/twin-anatomy-v1.glb",
    source: "bodyparts3d",
    candidate: false,
    sha256: "c5ee65bca7cc68ecb5df83986e0c9ce764fbdf82da8f777ed8600df2059d265d",
  },
  {
    path: "tests/twin-browser/assets/twin-anatomy-continuous-candidate.glb",
    source: "bodyparts3d",
    candidate: true,
    sha256: "50c847e66c5cc37bced5104a3644128d726dcec8d7f76e07127f04cf91bc4adc",
  },
  {
    path: "tests/twin-browser/assets/twin-anatomy-pose-candidate.glb",
    source: "bodyparts3d",
    candidate: true,
    sha256: "78f9290273242756b0f12299a5ae490f953e23788668b6dd8d4c11e557e9cba9",
  },
  {
    path: "tests/twin-browser/assets/twin-anatomy-muscular-candidate.glb",
    source: "makehuman",
    candidate: true,
    sha256: "5e965ec985c6eca556bf9059a707c259bcf3c7f7f0802f2388e4051fb4d03158",
  },
  {
    path: "tests/twin-browser/assets/twin-anatomy-sculpt-candidate.glb",
    source: "makehuman",
    candidate: true,
    sha256: "e94fdf6acf09bf82285d4797a5abef26e2928516ecb5e3a97aad78c32491ca31",
  },
] as const;

const SOURCE_CREDIT = {
  bodyparts3d: atlas.source.attribution,
  makehuman: "MakeHuman graphical assets (CC0) · GYMS.LIFE presentation model",
} as const;

export const MAX_TWIN_ASSET_BYTES = 8 * 1024 * 1024;

export async function verifyTwinAsset(bytes: ArrayBuffer): Promise<TwinBodyProvenance> {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_TWIN_ASSET_BYTES)
    throw new Error("Invalid Twin asset size");
  const header = new DataView(bytes);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error("Invalid Twin GLB header");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
  const registered = TWIN_REGISTERED_ASSETS.find((asset) => asset.sha256 === sha256);
  if (!registered) throw new Error("Unregistered Twin asset; source cannot be verified");
  return {
    source: registered.source,
    credit: SOURCE_CREDIT[registered.source],
    candidate: registered.candidate,
    sha256,
  };
}
