export type RunningEfficiencyEvidence = {
  day: string;
  distanceMeters: number;
  durationSeconds: number;
  averageHeartRateBpm: number | null;
  terrain: "flat" | "rolling" | "hilly" | "unknown";
  cadenceSpm: number | null;
};
export type EfficiencyPoint = {
  day: string;
  value: number;
  terrain: RunningEfficiencyEvidence["terrain"];
  cadenceSpm: number | null;
  provenance: "derived";
};
export function deriveRunningEfficiency(r: RunningEfficiencyEvidence): EfficiencyPoint | null {
  if (
    r.averageHeartRateBpm === null ||
    r.averageHeartRateBpm < 30 ||
    r.distanceMeters < 3000 ||
    r.durationSeconds <= 0
  )
    return null;
  const speed = r.distanceMeters / r.durationSeconds;
  return {
    day: r.day,
    value: Math.round((speed / r.averageHeartRateBpm) * 1e6) / 1e6,
    terrain: r.terrain,
    cadenceSpm: r.cadenceSpm,
    provenance: "derived",
  };
}
const med = (x: number[]) => {
  const a = [...x].sort((p, q) => p - q),
    m = Math.floor(a.length / 2);
  return a.length ? (a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2) : null;
};
export function assessComparableEfficiencyTrend(rows: readonly RunningEfficiencyEvidence[]) {
  const points = rows.flatMap((r) => {
    const p = deriveRunningEfficiency(r);
    return p ? [p] : [];
  });
  const groups = (["flat", "rolling", "hilly"] as const)
    .map((t) => ({ terrain: t, points: points.filter((p) => p.terrain === t) }))
    .sort((a, b) => b.points.length - a.points.length);
  const chosen = groups[0];
  if (!chosen || chosen.points.length < 6)
    return {
      status: "insufficient_evidence" as const,
      terrain: null,
      priorMedian: null,
      recentMedian: null,
      sessions: chosen?.points.length ?? 0,
    };
  const sorted = [...chosen.points].sort((a, b) => a.day.localeCompare(b.day)),
    mid = Math.floor(sorted.length / 2),
    prior = med(sorted.slice(0, mid).map((x) => x.value))!,
    recent = med(sorted.slice(mid).map((x) => x.value))!,
    ratio = recent / prior;
  return {
    status: (ratio >= 1.03 ? "improving" : ratio <= 0.97 ? "declining" : "stable") as
      "improving" | "declining" | "stable",
    terrain: chosen.terrain,
    priorMedian: prior,
    recentMedian: recent,
    sessions: sorted.length,
  };
}
