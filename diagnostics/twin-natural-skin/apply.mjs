import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const changed = [];
function readChecked(file, expected) {
  const content = readFileSync(file, 'utf8');
  const bytes = Buffer.from(content);
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(sha, expected, `Review changed base before patching ${file}`);
  return content;
}
function once(content, before, after) {
  assert.equal(content.split(before).length, 2, `Expected one exact source anchor: ${before.slice(0, 70)}`);
  return content.replace(before, after);
}
function between(content, start, end, replacement) {
  assert.equal(content.split(start).length, 2);
  assert.equal(content.split(end).length, 2);
  const a = content.indexOf(start), b = content.indexOf(end, a);
  assert.ok(b > a);
  return content.slice(0, a) + replacement + content.slice(b);
}
function save(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  changed.push(file);
}

save('src/components/twin/twin-skin.palette.ts', `import { Color } from "three";
import { TWIN_DISPLAY_COLORS, TWIN_TONE_GLOW, type TwinDisplayTone } from "./twin-scene.model";

/** Generic warm skin presentation, not a measurement or an inferred personal skin tone. */
export const TWIN_SKIN_MATERIAL = { color: 0xc99578, roughness: 0.74, metalness: 0 } as const;
export const TWIN_SELECTION_COLOR = "#147eae";
export const TWIN_SELECTION_EDGE = "#b8f4ff";

/** Selection is interaction state, never evidence of fatigue or recovery. */
export function twinRegionSurface({
  baseColor = TWIN_SKIN_MATERIAL.color,
  tone,
  appearance,
  selected,
  hasSelection,
}: {
  baseColor?: number;
  tone: TwinDisplayTone;
  appearance: "analysis" | "realistic";
  selected: boolean;
  hasSelection: boolean;
}) {
  const measured = tone !== "unknown" && tone !== "not_in_session";
  const accent = new Color(measured ? TWIN_DISPLAY_COLORS[tone] : TWIN_SELECTION_COLOR);
  const tint = selected ? 0.86 : appearance === "analysis" && measured ? (hasSelection ? 0.12 : 0.38) : 0;
  return {
    color: new Color(baseColor).lerp(accent, tint).getHex(),
    emissive: accent.getHex(),
    emissiveIntensity: selected ? 0.16 : appearance === "analysis" && measured ? 0.035 * TWIN_TONE_GLOW[tone] : 0,
    roughness: selected ? 0.62 : TWIN_SKIN_MATERIAL.roughness,
    metalness: TWIN_SKIN_MATERIAL.metalness,
  };
}
`);

let loader = readChecked('src/components/twin/twin-human.loader.ts', '85a63a9ad24fa1e09547cdfc6796022cece22943');
loader = 'import { TWIN_SKIN_MATERIAL } from "./twin-skin.palette";\n' + loader;
loader = between(loader, '/**\n * An unlit muscle', 'export type TwinBodyModel', `/** Both analysis and Body retain readable natural skin; evidence is a separate tint. */
const BODY = TWIN_SKIN_MATERIAL;
const REALISTIC_BODY = TWIN_SKIN_MATERIAL;
const SKIN = TWIN_SKIN_MATERIAL;
const REALISTIC_SKIN = TWIN_SKIN_MATERIAL;
const EYE = { color: 0x241814, roughness: 0.4, metalness: 0 };
const REALISTIC_EYE = EYE;

`);
save('src/components/twin/twin-human.loader.ts', loader);

let shader = readChecked('src/components/twin/twin-anatomy.material.ts', 'f0ebd9f725203d825df62f39f429ec5c57999136');
shader = 'import { TWIN_SKIN_MATERIAL, TWIN_SELECTION_EDGE } from "./twin-skin.palette";\n' + shader;
shader = once(shader, 'A cool edge on the existing surface keeps the dark anatomical silhouette', 'A studio edge on the existing surface keeps the natural anatomical silhouette');
shader = once(shader, 'export function createTwinAnatomyMaterial(', `const selectionUniforms = new WeakMap<MeshStandardMaterial, { value: number }>();

/** Update the existing shader uniform; no extra shell, postprocess, or per-click recompilation. */
export function setTwinAnatomySelection(material: MeshStandardMaterial, selected: boolean): void {
  const uniform = selectionUniforms.get(material);
  if (uniform) uniform.value = selected ? 1 : 0;
}

export function createTwinAnatomyMaterial(`);
shader = once(shader, '  const material = new MeshStandardMaterial(parameters);\n  material.onBeforeCompile = (shader) => {', `  const material = new MeshStandardMaterial(parameters);
  const selection = { value: 0 };
  selectionUniforms.set(material, selection);
  material.onBeforeCompile = (shader) => {
    shader.uniforms["twinSelection"] = selection;
    shader.uniforms["twinSelectionEdge"] = { value: new Color(TWIN_SELECTION_EDGE) };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\\nuniform float twinSelection;\\nuniform vec3 twinSelectionEdge;",
    );`);
shader = once(shader, 'new Color(0x354956)', 'new Color(TWIN_SKIN_MATERIAL.color)');
shader = once(shader, 'totalEmissiveRadiance += vec3(0.14, 0.38, 0.46) * twinRim * 0.18;', `totalEmissiveRadiance += vec3(0.14, 0.38, 0.46) * twinRim * 0.12;
      // The selection edge stays on the real region surface and respects its mask.
      float twinSelectedRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.0);
      float twinSelectionCoverage = \${regionMask ? "twinSurfaceMask" : "1.0"};
      float twinSelectionBoundary = 4.0 * twinSelectionCoverage * (1.0 - twinSelectionCoverage);
      totalEmissiveRadiance += twinSelectionEdge * twinSelection *
        (0.55 * twinSelectedRim * twinSelectionCoverage + 0.32 * twinSelectionBoundary);`);
shader = once(shader, 'twin-anatomy-rim-v7-', 'twin-anatomy-skin-selection-v8-');
save('src/components/twin/twin-anatomy.material.ts', shader);

let fallback = readChecked('src/components/twin/twin-body.geometry.ts', '405b74875a5259fab0fad36874420425672aaff1');
fallback = once(fallback, ', MeshStandardMaterial', '');
fallback = 'import { createTwinAnatomyMaterial } from "./twin-anatomy.material";\nimport { TWIN_SKIN_MATERIAL } from "./twin-skin.palette";\n' + fallback;
fallback = once(fallback, '  const meshes: Mesh[] = [];', '  const meshes: Mesh[] = [];\n  const baseColorOf = new Map<Mesh, number>();');
fallback = once(fallback, '    const material = new MeshStandardMaterial({\n      color: "#657076",\n      roughness: 0.48,\n      metalness: 0.22,\n    });', '    const material = createTwinAnatomyMaterial(TWIN_SKIN_MATERIAL);');
fallback = once(fallback, '    meshes.push(mesh);', '    meshes.push(mesh);\n    baseColorOf.set(mesh, TWIN_SKIN_MATERIAL.color);');
fallback = once(fallback, '    regionOf,\n    dispose()', '    regionOf,\n    baseColorOf,\n    dispose()');
fallback = once(fallback, '      regionOf.clear();', '      baseColorOf.clear();\n      regionOf.clear();');
save('src/components/twin/twin-body.geometry.ts', fallback);

let runtime = readChecked('src/components/twin/twin-scene.runtime.ts', '5659159da7e427a98ec6979b25f4111cbb79e3d3');
runtime = 'import { twinRegionSurface, TWIN_SKIN_MATERIAL } from "./twin-skin.palette";\nimport { setTwinAnatomySelection } from "./twin-anatomy.material";\n' + runtime;
for (const unused of ['  Color,\n', '  TWIN_DISPLAY_COLORS,\n', '  TWIN_SELECTION_GLOW,\n', '  TWIN_TONE_GLOW,\n']) runtime = once(runtime, unused, '');
runtime = between(runtime, '    // Under one, deliberately.', '    renderer.setClearColor', `    // Neutral exposure preserves a warm skin base in both analytical and Body views.
    const appearance = options.visualAppearance ?? "analysis";
    renderer.toneMappingExposure = 1.0;
`);
runtime = between(runtime, '    // Lit for a dark instrument', '    for (const [position, color, intensity] of lights)', `    // Neutral studio light keeps the front, back and unmeasured regions readable.
    // Selection uses its own bounded surface edge rather than brighter global bloom.
    scene.add(new HemisphereLight(0xfff1e8, 0x51463f, 1.0));
    const lights = [
      [[1.8, 2.8, 2.6], 0xfff1e8, 1.8],
      [[-2.4, 1.25, 1.8], 0xe3eff7, 0.85],
      [[-1.8, 1.9, -3.0], 0xffeadc, 1.25],
      [[2.2, 1.4, -2.6], 0xe3eff7, 0.9],
    ] as const;
`);
runtime = between(runtime, '    function applyState() {', '    const command = (action: TwinCameraCommand)', `    function applyState() {
      canvas.dataset["twinLayer"] = state.layer;
      canvas.dataset["twinSkinPalette"] = "natural";
      canvas.dataset["twinSelectedRegion"] = selectedRegion ?? "";
      const base = "baseColorOf" in model ? model.baseColorOf : null;
      for (const [id, meshes] of model.regionMeshes) {
        const value = state.regions.find((region) => region.id === id);
        const selected = selectedRegion === id;
        for (const mesh of meshes) {
          const material = mesh.material as MeshStandardMaterial;
          const surface = twinRegionSurface({
            baseColor: base?.get(mesh) ?? TWIN_SKIN_MATERIAL.color,
            tone: value?.display.tone ?? "unknown",
            appearance,
            selected,
            hasSelection: selectedRegion !== null,
          });
          material.color.set(surface.color);
          material.emissive.set(surface.emissive);
          material.emissiveIntensity = surface.emissiveIntensity;
          material.roughness = surface.roughness;
          material.metalness = surface.metalness;
          setTwinAnatomySelection(material, selected);
        }
      }
      requestRender();
    }

`);
save('src/components/twin/twin-scene.runtime.ts', runtime);

save('src/components/twin/twin-skin.palette.test.ts', `import { describe, expect, it } from "vitest";
import { Color, ShaderLib, UniformsUtils, type WebGLRenderer } from "three";
import { TWIN_SKIN_MATERIAL, twinRegionSurface } from "./twin-skin.palette";
import { TWIN_DISPLAY_COLORS, type TwinDisplayTone } from "./twin-scene.model";
import { createTwinAnatomyMaterial, setTwinAnatomySelection } from "./twin-anatomy.material";

describe("natural Twin surfaces and independent selection", () => {
  for (const appearance of ["analysis", "realistic"] as const) {
    it.each(["unknown", "not_in_session"] as const)(appearance + ": %s remains natural skin until selected", (tone) => {
      const idle = twinRegionSurface({ tone, appearance, selected: false, hasSelection: false });
      expect(idle.color).toBe(TWIN_SKIN_MATERIAL.color);
      expect(idle.emissiveIntensity).toBe(0);
      expect(idle.metalness).toBe(0);
      const active = twinRegionSurface({ tone, appearance, selected: true, hasSelection: true });
      const skin = new Color(idle.color), highlight = new Color(active.color);
      expect(Math.abs(skin.r - highlight.r) + Math.abs(skin.g - highlight.g) + Math.abs(skin.b - highlight.b)).toBeGreaterThan(0.3);
      expect(active.emissiveIntensity).toBeGreaterThan(0);
      expect(active.roughness).toBeGreaterThan(0.5);
    });
  }
  it.each(Object.keys(TWIN_DISPLAY_COLORS) as TwinDisplayTone[])("selection is reversible for %s without modifying evidence", (tone) => {
    const input = Object.freeze({ tone, appearance: "analysis" as const, selected: false, hasSelection: false });
    const original = twinRegionSurface(input);
    const active = twinRegionSurface({ ...input, selected: true, hasSelection: true });
    expect(active.color).not.toBe(original.color);
    expect(twinRegionSurface(input)).toEqual(original);
    expect(input.tone).toBe(tone);
    expect(active.metalness).toBe(0);
  });
  it("realistic view keeps unselected measured skin and analysis retains evidence tint", () => {
    const input = { tone: "moderate" as const, selected: false, hasSelection: false };
    expect(twinRegionSurface({ ...input, appearance: "realistic" }).color).toBe(TWIN_SKIN_MATERIAL.color);
    expect(twinRegionSurface({ ...input, appearance: "analysis" }).color).not.toBe(TWIN_SKIN_MATERIAL.color);
  });
  it("other regions recede without disappearing when one muscle is selected", () => {
    const input = { tone: "fresh" as const, appearance: "analysis" as const, selected: false };
    const color = new Color(twinRegionSurface({ ...input, hasSelection: true }).color);
    const skin = new Color(TWIN_SKIN_MATERIAL.color);
    const before = new Color(twinRegionSurface({ ...input, hasSelection: false }).color);
    expect(Math.abs(color.g - skin.g)).toBeLessThan(Math.abs(before.g - skin.g));
  });
  it.each([false, true])("selection uniform is live and masks keep skin neutral (mask=%s)", (regionMask) => {
    const material = createTwinAnatomyMaterial(TWIN_SKIN_MATERIAL, { regionMask });
    const shader = {
      uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    } as Parameters<typeof material.onBeforeCompile>[0];
    setTwinAnatomySelection(material, true);
    material.onBeforeCompile(shader, undefined as unknown as WebGLRenderer);
    expect(shader.uniforms["twinSelection"].value).toBe(1);
    const key = material.customProgramCacheKey();
    setTwinAnatomySelection(material, false);
    expect(shader.uniforms["twinSelection"].value).toBe(0);
    expect(material.customProgramCacheKey()).toBe(key);
    expect(material.transparent).toBe(false);
    expect(material.depthTest).toBe(true);
    if (regionMask) expect(shader.uniforms["twinNeutral"].value.getHex()).toBe(TWIN_SKIN_MATERIAL.color);
    material.dispose();
  });
});
`);

save('docs/twin-natural-skin.md', `# Twin natural skin and muscle-selection clarity\n\nThe default analytical body and the Body view use a generic warm skin material, not an inferred personal skin colour. Existing mesh assets, provenance, region picking, geometry, camera controls and evidence calculations are unchanged. A neutral region remains skin-coloured even when no measurement is present. Selecting it adds a blue surface tint and ice-coloured edge; this means selection, not recovery or fatigue. Known evidence retains the existing semantic hues. The edge is drawn in the existing opaque, depth-tested surface shader, respects regional masks and adds no translucent body shells or postprocessing.\n\nThe simplified 3D fallback shares the same palette. Private textured identity shells retain their own underlying identity surface. This change does not turn a generic body into a personal scan.\n\nValidation must include real rendered WebGL pixels for natural skin and selection, both visual modes, front/back regions and narrow/wide views, plus the normal Twin and Today regression gates. Unit tests alone cannot prove visual clarity.\n`);
writeFileSync('twin-skin-changed-files.json', JSON.stringify(changed, null, 2));
console.log('Applied source-checked natural-skin changes:', changed.join(', '));
