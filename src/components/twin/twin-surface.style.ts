import { Color, type MeshStandardMaterial } from "three";
import { TWIN_DISPLAY_COLORS, TWIN_TONE_GLOW, type TwinDisplayTone } from "./twin-scene.model";

/** Generic presentation colour, not an estimate of the athlete's skin or identity. */
export const TWIN_SKIN_COLOR = 0xc58f73;
export const TWIN_SKIN_MATERIAL = { color: TWIN_SKIN_COLOR, roughness: 0.72, metalness: 0 };
export const TWIN_EYE_MATERIAL = { color: 0x30211b, roughness: 0.42, metalness: 0 };
/** Selection is a UI cue, not recovery, workload or a diagnosis. */
export const TWIN_SELECTION_COLOR = 0x20bfff;

const neutralRoughness = new WeakMap<MeshStandardMaterial, number>();
/** Capture once, before selection changes it; deselection restores the authored finish. */
export function twinNeutralRoughness(material: MeshStandardMaterial): number {
  let value = neutralRoughness.get(material);
  if (value === undefined) {
    value = material.roughness;
    neutralRoughness.set(material, value);
  }
  return value;
}

/** One visual policy for anatomical assets and the generated fallback. No data is mutated. */
export function twinSurfaceStyle({
  tone,
  selected,
  hasSelection,
  appearance,
  baseColor = TWIN_SKIN_COLOR,
  baseRoughness = TWIN_SKIN_MATERIAL.roughness,
}: {
  tone: TwinDisplayTone;
  selected: boolean;
  hasSelection: boolean;
  appearance: "analysis" | "realistic";
  baseColor?: number;
  baseRoughness?: number;
}) {
  const hasEvidence = tone !== "unknown" && tone !== "not_in_session";
  const signal = new Color(hasEvidence ? TWIN_DISPLAY_COLORS[tone] : TWIN_SELECTION_COLOR);
  // Selected unknown regions must not be tinted toward the old near-black unknown tone.
  const tint = selected
    ? hasEvidence
      ? 0.9
      : 0.86
    : appearance === "analysis" && hasEvidence
      ? hasSelection
        ? 0.2
        : 0.5
      : 0;
  const glow = selected
    ? 0.18
    : appearance === "analysis" && hasEvidence
      ? TWIN_TONE_GLOW[tone] * (hasSelection ? 0.025 : 0.065)
      : 0;
  return {
    color: new Color(baseColor).lerp(signal, tint),
    emissive: signal,
    emissiveIntensity: Math.min(0.4, glow / Math.max(signal.r, signal.g, signal.b, 0.25)),
    roughness: selected ? Math.max(0, baseRoughness - 0.1) : baseRoughness,
    metalness: 0,
  };
}
