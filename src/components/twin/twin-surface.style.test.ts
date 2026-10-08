import { describe, expect, it } from "vitest";
import { Color, MeshStandardMaterial, type WebGLRenderer } from "three";
import { createTwinBody } from "./twin-body.geometry";
import { createTwinAnatomyMaterial, setTwinAnatomySelection } from "./twin-anatomy.material";
import { TWIN_DISPLAY_COLORS, TWIN_TONE_GLOW, type TwinDisplayTone } from "./twin-scene.model";
import { TWIN_SKIN_COLOR, TWIN_SKIN_MATERIAL, twinSurfaceStyle } from "./twin-surface.style";

const style = (tone: TwinDisplayTone, selected = false, appearance: "analysis" | "realistic" = "analysis") =>
  twinSurfaceStyle({ tone, selected, appearance, hasSelection: selected });

describe("skin-forward Twin selection", () => {
  it.each(["analysis", "realistic"] as const)("keeps missing evidence skin-coloured in %s", (appearance) => {
    for (const tone of ["unknown", "not_in_session"] as const) {
      const result = style(tone, false, appearance);
      expect(result.color.getHex()).toBe(TWIN_SKIN_COLOR);
      expect(result.metalness).toBe(0);
      expect(result.emissiveIntensity).toBe(0);
    }
  });
  it.each(["analysis", "realistic"] as const)("highlights unknown selection independently of its black data tone in %s", (appearance) => {
    const ordinary = style("unknown", false, appearance);
    const selected = style("unknown", true, appearance);
    expect(selected.color.b).toBeGreaterThan(selected.color.r);
    expect(selected.emissiveIntensity).toBeGreaterThan(0.1);
    expect(selected.color.getHex()).not.toBe(new Color(TWIN_DISPLAY_COLORS.unknown).getHex());
    expect(selected.color.getHex()).not.toBe(ordinary.color.getHex());
    expect(TWIN_TONE_GLOW.unknown).toBe(0);
  });
  it("keeps state colours distinct, not a single selection/health colour", () => {
    const tones = ["fresh", "moderate", "fatigued", "in_session"] as const;
    expect(new Set(tones.map(tone => style(tone, true).color.getHex())).size).toBe(4);
    expect(style("fatigued", true).color.r).toBeGreaterThan(style("fatigued", true).color.b);
  });
  it("quiets other evidence without making the body transparent or black", () => {
    const normal = style("moderate");
    const other = twinSurfaceStyle({ tone: "moderate", selected: false, hasSelection: true, appearance: "analysis" });
    expect(other.emissiveIntensity).toBeLessThan(normal.emissiveIntensity);
    expect(other.color.r).toBeGreaterThan(normal.color.r);
    expect(other.metalness).toBe(0);
  });
  it("keeps Body appearance neutral until a region is selected", () => {
    expect(style("fatigued", false, "realistic").color.getHex()).toBe(TWIN_SKIN_COLOR);
    expect(style("fatigued", true, "realistic").color.getHex()).not.toBe(TWIN_SKIN_COLOR);
  });
  it("restores neutral skin after deselecting a region", () => {
    const m = new MeshStandardMaterial(TWIN_SKIN_MATERIAL);
    m.color.copy(style("unknown", true).color);
    m.color.copy(style("unknown", false).color);
    expect(m.color.getHex()).toBe(TWIN_SKIN_COLOR);
    m.dispose();
  });
  it("uses the same skin and opaque selection shader for the generated fallback", () => {
    const body = createTwinBody();
    for (const mesh of body.meshes) {
      const material = mesh.material as MeshStandardMaterial;
      expect(material.color.getHex()).toBe(TWIN_SKIN_COLOR);
      expect(material.transparent).toBe(false);
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(true);
    }
    body.dispose();
  });
  it("keeps neutral masked seams skin-coloured and selection uniforms alive across shader compilation", () => {
    const material = createTwinAnatomyMaterial(TWIN_SKIN_MATERIAL, { regionMask: true });
    setTwinAnatomySelection(material, true);
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>",
    } as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader.uniforms["twinNeutral"]?.value.getHex()).toBe(TWIN_SKIN_COLOR);
    expect(shader.uniforms["twinSelected"]?.value).toBe(1);
    setTwinAnatomySelection(material, false);
    expect(shader.uniforms["twinSelected"]?.value).toBe(0);
    expect(shader.fragmentShader).toContain("twinSelected * 0.55");
    expect(shader.fragmentShader).not.toContain("\\n");
    expect(shader.fragmentShader).toContain("* twinSurfaceMask");
    expect(material.customProgramCacheKey()).toContain("skin-selection-v8");
    expect(material.transparent).toBe(false);
    material.dispose();
  });
});
