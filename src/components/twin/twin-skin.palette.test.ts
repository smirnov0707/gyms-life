import { describe, expect, it } from "vitest";
import { Color, ShaderLib, UniformsUtils, type WebGLRenderer } from "three";
import { TWIN_SKIN_MATERIAL, twinRegionSurface } from "./twin-skin.palette";
import { TWIN_DISPLAY_COLORS, type TwinDisplayTone } from "./twin-scene.model";
import { createTwinAnatomyMaterial, setTwinAnatomySelection } from "./twin-anatomy.material";

describe("natural Twin surfaces and independent selection", () => {
  for (const appearance of ["analysis", "realistic"] as const) {
    it.each(["unknown", "not_in_session"] as const)(
      appearance + ": %s remains natural skin until selected",
      (tone) => {
        const idle = twinRegionSurface({ tone, appearance, selected: false, hasSelection: false });
        expect(idle.color).toBe(TWIN_SKIN_MATERIAL.color);
        expect(idle.emissiveIntensity).toBe(0);
        expect(idle.metalness).toBe(0);
        const active = twinRegionSurface({ tone, appearance, selected: true, hasSelection: true });
        const skin = new Color(idle.color),
          highlight = new Color(active.color);
        expect(
          Math.abs(skin.r - highlight.r) +
            Math.abs(skin.g - highlight.g) +
            Math.abs(skin.b - highlight.b),
        ).toBeGreaterThan(0.3);
        expect(active.emissiveIntensity).toBeGreaterThan(0);
        expect(active.roughness).toBeGreaterThan(0.5);
      },
    );
  }
  it.each(Object.keys(TWIN_DISPLAY_COLORS) as TwinDisplayTone[])(
    "selection is reversible for %s without modifying evidence",
    (tone) => {
      const input = Object.freeze({
        tone,
        appearance: "analysis" as const,
        selected: false,
        hasSelection: false,
      });
      const original = twinRegionSurface(input);
      const active = twinRegionSurface({ ...input, selected: true, hasSelection: true });
      expect(active.color).not.toBe(original.color);
      expect(twinRegionSurface(input)).toEqual(original);
      expect(input.tone).toBe(tone);
      expect(active.metalness).toBe(0);
    },
  );
  it("realistic view keeps unselected measured skin and analysis retains evidence tint", () => {
    const input = { tone: "moderate" as const, selected: false, hasSelection: false };
    expect(twinRegionSurface({ ...input, appearance: "realistic" }).color).toBe(
      TWIN_SKIN_MATERIAL.color,
    );
    expect(twinRegionSurface({ ...input, appearance: "analysis" }).color).not.toBe(
      TWIN_SKIN_MATERIAL.color,
    );
  });
  it("other regions recede without disappearing when one muscle is selected", () => {
    const input = { tone: "fresh" as const, appearance: "analysis" as const, selected: false };
    const color = new Color(twinRegionSurface({ ...input, hasSelection: true }).color);
    const skin = new Color(TWIN_SKIN_MATERIAL.color);
    const before = new Color(twinRegionSurface({ ...input, hasSelection: false }).color);
    expect(Math.abs(color.g - skin.g)).toBeLessThan(Math.abs(before.g - skin.g));
  });
  it.each([false, true])(
    "selection uniform is live and masks keep skin neutral (mask=%s)",
    (regionMask) => {
      const material = createTwinAnatomyMaterial(TWIN_SKIN_MATERIAL, { regionMask });
      const shader = {
        uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
        vertexShader: ShaderLib.standard.vertexShader,
        fragmentShader: ShaderLib.standard.fragmentShader,
      } as Parameters<typeof material.onBeforeCompile>[0];
      setTwinAnatomySelection(material, true);
      material.onBeforeCompile(shader, undefined as unknown as WebGLRenderer);
      expect(shader.uniforms["twinSelection"]?.value).toBe(1);
      const key = material.customProgramCacheKey();
      setTwinAnatomySelection(material, false);
      expect(shader.uniforms["twinSelection"]?.value).toBe(0);
      expect(material.customProgramCacheKey()).toBe(key);
      expect(material.transparent).toBe(false);
      expect(material.depthTest).toBe(true);
      if (regionMask)
        expect(shader.uniforms["twinNeutral"]?.value.getHex()).toBe(TWIN_SKIN_MATERIAL.color);
      material.dispose();
    },
  );
});
