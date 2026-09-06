import { z } from "zod";
import {
  SessionMuscleContributionSchema,
  type SessionMuscleContribution,
} from "@/lib/session-muscle-breakdown";
import { TWIN_BODY_REGIONS, type TwinRegionDisplay, type TwinSceneState } from "./twin-scene.model";
export const SESSION_REPLAY_LAYERS = ["session_sets", "session_volume"] as const;
export type SessionReplayLayer = (typeof SESSION_REPLAY_LAYERS)[number];
export function getSessionReplayDisplay(
  contributions: readonly SessionMuscleContribution[],
  id: string,
  layer: SessionReplayLayer,
): TwinRegionDisplay {
  const entry = contributions.find((item) => item.muscleGroup === id);
  const value = entry ? (layer === "session_sets" ? entry.sets : entry.volumeKg) : null;
  if (value === null || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER)
    return { value: null, tone: "unknown" };
  const maximum = contributions.reduce((max, item) => {
    const quantity = layer === "session_sets" ? item.sets : item.volumeKg;
    return quantity !== null &&
      Number.isFinite(quantity) &&
      quantity >= 0 &&
      quantity <= Number.MAX_SAFE_INTEGER
      ? Math.max(max, quantity)
      : max;
  }, 0);
  const fraction = maximum > 0 ? value / maximum : 0;
  return {
    value,
    tone: fraction <= 1 / 3 ? "volume_low" : fraction <= 2 / 3 ? "volume_medium" : "volume_high",
  };
}
/** Session facts directly to display state. No fake TwinSnapshot or recovery percentages. */
export function mapSessionReplayScene(
  contributions: readonly SessionMuscleContribution[],
  layer: SessionReplayLayer,
): TwinSceneState {
  const parsed = z.array(SessionMuscleContributionSchema).parse(contributions);
  const dataAvailable = !parsed.some((entry) => entry.mappingStatus === "unavailable");
  return {
    layer,
    dataAvailable,
    regions: TWIN_BODY_REGIONS.map((id) => ({
      id,
      band: "unknown",
      recoveryPct: null,
      emphasis: 0,
      display: dataAvailable
        ? getSessionReplayDisplay(parsed, id, layer)
        : { value: null, tone: "unknown" },
    })),
  };
}
export function formatSessionReplayValue(
  value: number | null,
  layer: SessionReplayLayer,
  language: "lt" | "en",
): string {
  if (value === null) return "—";
  const number = new Intl.NumberFormat(language === "lt" ? "lt-LT" : "en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
  if (layer === "session_volume")
    return `${number} ${language === "lt" ? "kg × pakart." : "kg × reps"}`;
  if (language === "en") return `${number} ${value === 1 ? "set" : "sets"}`;
  const last = value % 10;
  const hundred = value % 100;
  const noun =
    last === 1 && hundred !== 11
      ? "setas"
      : last >= 2 && last <= 9 && (hundred < 10 || hundred >= 20)
        ? "setai"
        : "setų";
  return `${number} ${noun}`;
}
