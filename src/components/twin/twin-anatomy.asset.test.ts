import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TWIN_BODY_REGIONS, TWIN_FRAME } from "./twin-scene.model";

/**
 * The shipped figure is a binary nobody reads in review, built by a script
 * nobody runs in CI, from an atlas of two thousand named meshes. Everything
 * that can go wrong with it is invisible in a diff and obvious on screen: a
 * region with no surface is a body part the app offers and cannot show, a
 * mesh filed under the wrong region paints one muscle group's recovery on
 * another's, and a figure that drifts off the origin is framed by a camera
 * pointing at empty space.
 *
 * So this measures the file itself — its geometry, in metres, where the
 * browser will draw it — rather than trusting the manifest's own claims.
 */

const MODELS = path.resolve("public/models");
const FILE = path.join(MODELS, "twin-anatomy-v1.glb");

const manifest = JSON.parse(
  readFileSync(path.join(MODELS, "twin-anatomy.manifest.json"), "utf8"),
) as {
  version: string;
  file: string;
  bytes: number;
  gzipBytes: number;
  targetHeightMetres: number;
  source: Record<string, string>;
  regions: Record<string, { meshes: number; sourceTriangles: number; triangles: number }>;
};

const bytes = readFileSync(FILE);

/** Every region's surface, in world metres, as three.js will place it. */
const placed = await (async () => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise<{ scene: import("three").Object3D }>((done, failed) => {
    new GLTFLoader().parse(buffer as ArrayBuffer, "", done, failed);
  });
  gltf.scene.updateMatrixWorld(true);
  const boxes = new Map<string, Box3>();
  const whole = new Box3();
  gltf.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const name = String(object.material.name);
    const box = new Box3().setFromObject(object);
    whole.union(box);
    const region = name.startsWith("twin-region:") ? name.slice("twin-region:".length) : name;
    boxes.set(region, box);
  });
  return { boxes, whole };
})();

/** A region's box, or a failure naming the region rather than `undefined`. */
function boxOf(region: string): Box3 {
  const box = placed.boxes.get(region);
  if (!box) throw new Error(`the figure has no surface for ${region}`);
  return box;
}

describe("twin anatomy asset", () => {
  it("is the file the manifest describes", () => {
    expect(manifest.file).toBe("models/twin-anatomy-v1.glb");
    expect(bytes.byteLength).toBe(manifest.bytes);
  });

  it("carries the attribution the licence requires", () => {
    // CC BY-SA is not satisfied by a file sitting in the repository: the
    // credit has to travel with it, and the share-alike term has to be
    // written down somewhere a future rebuild will see it.
    expect(manifest.source["licence"]).toBe("CC BY-SA 2.1 JP");
    expect(manifest.source["attribution"]).toContain("BodyParts3D");
    expect(manifest.source["attribution"]).toContain("Database Center for Life Science");
    expect(manifest.source["licenceUrl"]).toMatch(/^https?:\/\//);
    expect(manifest.source["requirements"]).toMatch(/same licence/i);
  });

  it("stays inside the mobile budget", () => {
    // A whole anatomical atlas costs more than the smooth mannequin it
    // replaced: about 4.2 MB, 2.5 MB over the wire. The cap sits just above
    // that rather than at a comfortable round number, because a limit nothing
    // is near does not stop the next rebuild from doubling it.
    expect(manifest.bytes).toBeLessThan(4.6 * 1024 * 1024);
    expect(manifest.gzipBytes).toBeLessThan(2.8 * 1024 * 1024);
  });

  it("covers every region the figure is coloured by", () => {
    // A region with a handful of triangles is a target no finger can hit.
    for (const region of TWIN_BODY_REGIONS) {
      expect(manifest.regions[region]?.triangles ?? 0).toBeGreaterThan(500);
      expect(placed.boxes.has(region)).toBe(true);
    }
  });

  it("carries the region on a material name, where glTF can keep it", () => {
    // Primitives have no name in the glTF spec, so the region travels on the
    // material — and a dedup pass that merged materials by their properties
    // once collapsed all nine into one, which silently made every click
    // report the same region.
    for (const region of TWIN_BODY_REGIONS) expect(placed.boxes.has(region)).toBe(true);
    expect(placed.boxes.has("neutral")).toBe(true);
    expect(placed.boxes.size).toBe(TWIN_BODY_REGIONS.length + 1); // + the kept skin
  });

  it("stands on the ground, centred on the origin the camera orbits", () => {
    const { min, max } = placed.whole;
    expect(Math.abs(min.y)).toBeLessThan(0.01);
    expect(Math.abs((min.x + max.x) / 2)).toBeLessThan(0.01);
    // Looser front to back on purpose. The build centres the figure on the
    // mean of its own surface, and a real body is not symmetric about that
    // plane — the buttocks reach further back than the belly does forward, so
    // the box's midpoint sits about a centimetre behind the orbit centre and
    // always will.
    expect(Math.abs((min.z + max.z) / 2)).toBeLessThan(0.02);
    expect(max.y - min.y).toBeCloseTo(manifest.targetHeightMetres, 2);
  });

  it("is the figure the camera is set up to frame", () => {
    // TWIN_FRAME is a measurement of this file, written down in the code
    // because the renderer cannot wait for the asset to load before it picks
    // a camera distance. If the two drift apart the athlete gets a figure
    // that either floats in black or has its feet cut off.
    const { min, max } = placed.whole;
    expect(max.y - min.y).toBeCloseTo(TWIN_FRAME.height, 2);
    const turnDiameter =
      2 * Math.max(Math.abs(min.x), max.x, Math.abs(min.z), max.z, Math.hypot(max.x, max.z));
    expect(turnDiameter).toBeLessThanOrEqual(TWIN_FRAME.turnDiameter);
    // And not so much smaller that the frame is mostly padding.
    expect(turnDiameter).toBeGreaterThan(TWIN_FRAME.turnDiameter * 0.85);
    expect(TWIN_FRAME.eyeHeight).toBeGreaterThan(min.y);
    expect(TWIN_FRAME.eyeHeight).toBeLessThan(max.y);
  });

  describe("puts each region where that part of a body is", () => {
    // The region map is a list of anatomical names matched by pattern, and a
    // name it reads wrongly lands somewhere the athlete can see. An earlier
    // pattern accepted "extensor digitorum longus" — the shin — as a forearm
    // muscle, and the figure showed the athlete's arm recovery on their feet.
    // These bounds are deliberately loose: they are the difference between
    // limbs and halves of a body, not a fit to the current mesh.
    const height = TWIN_FRAME.height;
    const cases: [string, { above?: number; below?: number; front?: boolean; back?: boolean }][] = [
      // Nothing above the collarbone and nothing below the navel.
      ["chest", { above: 0.62 * height, below: 0.86 * height, front: true }],
      ["shoulders", { above: 0.71 * height, below: 0.86 * height }],
      // The trapezius reaches the skull; the erector spinae reaches the waist.
      ["back", { above: 0.6 * height, below: 0.95 * height, back: true }],
      // Shoulder to fingertips. The hands hang by the hips, so nothing lower.
      ["arms", { above: 0.4 * height, below: 0.85 * height }],
      ["abs", { above: 0.48 * height, below: 0.78 * height, front: true }],
      ["core", { above: 0.6 * height, below: 0.86 * height }],
      ["glutes", { above: 0.41 * height, below: 0.62 * height, back: true }],
      // Hip to the soles.
      ["legs", { above: -0.01, below: 0.7 * height }],
    ];
    for (const [region, bounds] of cases) {
      it(region, () => {
        const box = boxOf(region);
        if (bounds.above !== undefined) expect(box.min.y).toBeGreaterThanOrEqual(bounds.above);
        if (bounds.below !== undefined) expect(box.max.y).toBeLessThanOrEqual(bounds.below);
        // The atlas faces +Z. A region that belongs to the front of the body
        // must have surface there, and one on the back must not be centred in
        // front of the spine.
        const centre = new Vector3();
        box.getCenter(centre);
        if (bounds.front) expect(centre.z).toBeGreaterThan(0);
        if (bounds.back) expect(centre.z).toBeLessThan(0);
      });
    }

    it("keeps the arms off the feet", () => {
      // The specific failure this file was written for. The arms end at the
      // fingertips, which on a standing figure is mid-thigh; anything of
      // theirs below the knee is a leg muscle wearing an arm's colour.
      expect(boxOf("arms").min.y).toBeGreaterThan(0.35 * TWIN_FRAME.height);
      expect(boxOf("legs").min.y).toBeLessThan(0.02 * TWIN_FRAME.height);
    });
  });
});
