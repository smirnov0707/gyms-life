export type PaceRunEvidence = {
  day: string;
  distanceMeters: number;
  durationSeconds: number;
  intent: "easy" | "long" | "tempo" | "intervals" | "recovery" | "race" | null;
  perceivedEffort: number | null;
};

export type PaceProfile = {
  evidenceRuns: number;
  evidenceLevel: "low" | "moderate" | "high";
  medianSecondsPerKm: number | null;
  recentMedianSecondsPerKm: number | null;
  priorMedianSecondsPerKm: number | null;
  trend: "insufficient_evidence" | "faster" | "stable" | "slower";
  byIntent: Partial<
    Record<NonNullable<PaceRunEvidence["intent"]>, { runs: number; medianSecondsPerKm: number }>
  >;
};

const pace = (r: PaceRunEvidence) =>
  r.distanceMeters > 0 && r.durationSeconds > 0
    ? r.durationSeconds / (r.distanceMeters / 1000)
    : null;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : Math.round((a[m - 1]! + a[m]!) / 2);
};
export function buildPaceProfile(runs: readonly PaceRunEvidence[]): PaceProfile {
  const valid = runs
    .filter(
      (r) =>
        Number.isFinite(r.distanceMeters) &&
        r.distanceMeters >= 1000 &&
        Number.isFinite(r.durationSeconds) &&
        r.durationSeconds > 0,
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  const paces = valid.flatMap((r) => {
    const p = pace(r);
    return p === null || p < 120 || p > 1200 ? [] : [p];
  });
  const split = Math.max(1, Math.floor(paces.length / 2)),
    prior = median(paces.slice(0, split)),
    recent = median(paces.slice(split));
  let trend: PaceProfile["trend"] = "insufficient_evidence";
  if (paces.length >= 6 && prior !== null && recent !== null) {
    const ratio = recent / prior;
    trend = ratio <= 0.97 ? "faster" : ratio >= 1.03 ? "slower" : "stable";
  }
  const byIntent: PaceProfile["byIntent"] = {};
  for (const intent of ["easy", "long", "tempo", "intervals", "recovery", "race"] as const) {
    const vals = valid
      .filter((r) => r.intent === intent)
      .flatMap((r) => {
        const p = pace(r);
        return p === null ? [] : [p];
      });
    const m = median(vals);
    if (m !== null) byIntent[intent] = { runs: vals.length, medianSecondsPerKm: m };
  }
  return {
    evidenceRuns: paces.length,
    evidenceLevel: paces.length >= 12 ? "high" : paces.length >= 6 ? "moderate" : "low",
    medianSecondsPerKm: median(paces),
    recentMedianSecondsPerKm: recent,
    priorMedianSecondsPerKm: prior,
    trend,
    byIntent,
  };
}
