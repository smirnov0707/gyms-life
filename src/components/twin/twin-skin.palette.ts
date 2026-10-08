import { Color } from "three";
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
  const tint = selected
    ? 0.86
    : appearance === "analysis" && measured
      ? hasSelection
        ? 0.12
        : 0.38
      : 0;
  return {
    color: new Color(baseColor).lerp(accent, tint).getHex(),
    emissive: accent.getHex(),
    emissiveIntensity: selected
      ? 0.16
      : appearance === "analysis" && measured
        ? 0.035 * TWIN_TONE_GLOW[tone]
        : 0,
    roughness: selected ? 0.62 : TWIN_SKIN_MATERIAL.roughness,
    metalness: TWIN_SKIN_MATERIAL.metalness,
  };
}
