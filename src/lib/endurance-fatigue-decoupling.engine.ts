export type FatigueSplit = {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  averageHeartRateBpm: number | null;
  cadenceSpm: number | null;
};
export type FatigueDecoupling = {
  status: "insufficient_evidence" | "measured";
  paceChangeFraction: number | null;
  heartRateChangeFraction: number | null;
  cadenceChangeFraction: number | null;
  pattern: "none" | "cardiovascular_drift" | "multi_signal_fatigue" | null;
  provenance: "derived";
};
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length,
  chg = (a: number, b: number) => (a === 0 ? null : b / a - 1);
export function assessFatigueDecoupling(splits: readonly FatigueSplit[]): FatigueDecoupling {
  const valid = splits.filter((s) => s.distanceMeters > 0 && s.durationSeconds > 0);
  if (valid.length < 6)
    return {
      status: "insufficient_evidence",
      paceChangeFraction: null,
      heartRateChangeFraction: null,
      cadenceChangeFraction: null,
      pattern: null,
      provenance: "derived",
    };
  const mid = Math.floor(valid.length / 2),
    first = valid.slice(0, mid),
    second = valid.slice(mid);
  const pace1 = mean(first.map((s) => s.durationSeconds / (s.distanceMeters / 1000))),
    pace2 = mean(second.map((s) => s.durationSeconds / (s.distanceMeters / 1000)));
  const hrs1 = first.flatMap((s) =>
      s.averageHeartRateBpm === null ? [] : [s.averageHeartRateBpm],
    ),
    hrs2 = second.flatMap((s) => (s.averageHeartRateBpm === null ? [] : [s.averageHeartRateBpm]));
  const cad1 = first.flatMap((s) => (s.cadenceSpm === null ? [] : [s.cadenceSpm])),
    cad2 = second.flatMap((s) => (s.cadenceSpm === null ? [] : [s.cadenceSpm]));
  const paceChange = chg(pace1, pace2),
    hrChange =
      hrs1.length === first.length && hrs2.length === second.length
        ? chg(mean(hrs1), mean(hrs2))
        : null,
    cadChange =
      cad1.length === first.length && cad2.length === second.length
        ? chg(mean(cad1), mean(cad2))
        : null;
  let pattern: FatigueDecoupling["pattern"] = "none";
  if (
    paceChange !== null &&
    paceChange > 0.03 &&
    hrChange !== null &&
    hrChange > 0.03 &&
    cadChange !== null &&
    cadChange < -0.02
  )
    pattern = "multi_signal_fatigue";
  else if (hrChange !== null && hrChange > 0.04 && paceChange !== null && paceChange >= 0)
    pattern = "cardiovascular_drift";
  return {
    status: "measured",
    paceChangeFraction: paceChange,
    heartRateChangeFraction: hrChange,
    cadenceChangeFraction: cadChange,
    pattern,
    provenance: "derived",
  };
}
