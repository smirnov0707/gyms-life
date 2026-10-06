export type LongRunEvidence = { day: string; distanceMeters: number };
export type LongRunProgress =
  | {
      status: "insufficient_evidence";
      recentLongestMeters: number | null;
      priorLongestMeters: number | null;
      progressRatio: null;
    }
  | {
      status: "stable" | "progressing" | "regressing";
      recentLongestMeters: number;
      priorLongestMeters: number;
      progressRatio: number;
    };

const round2 = (v: number) => Math.round(v * 100) / 100;
export function assessLongRunProgress(runs: readonly LongRunEvidence[]): LongRunProgress {
  const valid = runs
    .filter((r) => Number.isFinite(r.distanceMeters) && r.distanceMeters > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (valid.length < 2)
    return {
      status: "insufficient_evidence",
      recentLongestMeters: valid[0]?.distanceMeters ?? null,
      priorLongestMeters: null,
      progressRatio: null,
    };
  const split = Math.max(1, Math.floor(valid.length / 2));
  const prior = Math.max(...valid.slice(0, split).map((r) => r.distanceMeters));
  const recent = Math.max(...valid.slice(split).map((r) => r.distanceMeters));
  const ratio = round2(recent / prior);
  return {
    status: ratio >= 1.08 ? "progressing" : ratio < 0.85 ? "regressing" : "stable",
    recentLongestMeters: recent,
    priorLongestMeters: prior,
    progressRatio: ratio,
  };
}

export function raceSpecificLongRunCoverage(
  recentLongestMeters: number | null,
  raceDistanceMeters: number,
): number | null {
  if (recentLongestMeters === null || recentLongestMeters <= 0 || raceDistanceMeters <= 0)
    return null;
  return round2(Math.min(1, recentLongestMeters / raceDistanceMeters));
}
