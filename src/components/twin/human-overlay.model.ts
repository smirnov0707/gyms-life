import { TWIN_DISPLAY_COLORS, type TwinBodyRegion, type TwinSceneState } from "./twin-scene.model";

/** Presentation tint, never a physiological calculation or an opacity-as-confidence score. */
export function humanOverlayStyle(
  state: TwinSceneState,
  region: TwinBodyRegion,
  selected: string | null,
  natural: boolean,
) {
  const evidence = state.regions.find((entry) => entry.id === region)?.display;
  const tone = state.dataAvailable && evidence?.value != null ? evidence.tone : "unknown";
  if (selected === region) return { color: "#c4ddd8", amount: natural ? 0.12 : 0.26 };
  return {
    color: TWIN_DISPLAY_COLORS[tone],
    amount: natural ? 0 : tone === "unknown" ? 0.08 : 0.18,
  };
}
