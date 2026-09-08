import type { BodyMapTone } from "./BodyMap";

/**
 * What the change map may say about one region, and in what colour.
 *
 * The map compares two stored Twin states and paints each region by which way
 * its recovery estimate moved. It used to give a region with no comparable
 * measurement and a region measured as unchanged the same faint grey — and its
 * own legend admitted it, in both languages: "Estimate unchanged / unknown".
 *
 * Those are not the same claim. One is "we compared this and it held", which is
 * a finding. The other is "we could not compare this", which is a fact about
 * the data. On a body map the colour is what the athlete reads at a glance, so
 * the colour has to tell them apart.
 *
 * A second thing the split fixes: the tone came off the raw delta while the
 * number beside it was rounded, so a difference of four hundredths of a point
 * painted the region green and printed "+0 pp" underneath. The reading and the
 * colour now come from the same call and cannot disagree.
 */
export type RegionChange =
  | { readonly state: "absent" }
  | { readonly state: "unchanged" }
  | { readonly state: "changed"; readonly delta: number };

/** Decimal places the map prints a difference to. */
export const CHANGE_DIGITS = 1;

/**
 * One region's change, at the precision the map actually shows.
 *
 * Anything that rounds to zero at that precision is "unchanged": a difference
 * the athlete cannot see in the number must not be a direction they can see in
 * the colour.
 */
export function regionChange(delta: number | null, digits = CHANGE_DIGITS): RegionChange {
  if (delta === null || !Number.isFinite(delta)) return { state: "absent" };
  const rounded = Number(delta.toFixed(digits));
  // Zero rather than -0, so a tiny negative never prints as "-0".
  return rounded === 0 ? { state: "unchanged" } : { state: "changed", delta: rounded };
}

/**
 * The tone a region is painted in.
 *
 * `muted` is drawn faint on purpose — the body map's own comment for it is
 * "regions with nothing behind them stay quiet: present, not claiming" — so it
 * belongs to `absent` alone. A measured no-change is a measurement, and it is
 * drawn at full presence in a colour that points nowhere.
 */
export function changeTone(change: RegionChange): BodyMapTone {
  if (change.state === "absent") return "muted";
  if (change.state === "unchanged") return "neutral";
  return change.delta > 0 ? "cool" : "hot";
}
