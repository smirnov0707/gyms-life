import { isAnatomicalRegion } from "@/components/twin/body-map.geometry";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";

const KNOWN_GROUPS = new Set<string>(KNOWN_MUSCLE_GROUPS);
export const isTwinDetailRegion = (region: string) =>
  KNOWN_GROUPS.has(region) || isAnatomicalRegion(region);

export const TWIN_VIEWS = ["overview", "muscles", "systems"] as const;
export const TWIN_DETAIL_TABS = ["status", "history", "impact"] as const;
export type TwinViewId = (typeof TWIN_VIEWS)[number];
export type TwinDetailTab = (typeof TWIN_DETAIL_TABS)[number];
export type TwinNavigation = {
  view?: TwinViewId;
  region?: string;
  detail?: TwinDetailTab;
};

/** URL state is presentation only. It never writes an athlete measurement. */
export function parseTwinNavigation(search: Record<string, unknown>): TwinNavigation {
  const result: TwinNavigation = {};
  if (TWIN_VIEWS.some((view) => view === search["view"]))
    result.view = search["view"] as TwinViewId;
  if (typeof search["region"] === "string" && isTwinDetailRegion(search["region"])) {
    result.region = search["region"];
    if (TWIN_DETAIL_TABS.some((tab) => tab === search["detail"])) {
      result.detail = search["detail"] as TwinDetailTab;
    }
  }
  return result;
}

export function nextTwinView(active: TwinViewId, key: string): TwinViewId | null {
  if (key === "Home") return TWIN_VIEWS[0];
  if (key === "End") return TWIN_VIEWS[TWIN_VIEWS.length - 1] ?? active;
  if (key !== "ArrowRight" && key !== "ArrowLeft") return null;
  const direction = key === "ArrowRight" ? 1 : -1;
  return (
    TWIN_VIEWS[(TWIN_VIEWS.indexOf(active) + direction + TWIN_VIEWS.length) % TWIN_VIEWS.length] ??
    active
  );
}
