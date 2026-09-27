import { baseState } from "./trend-fixtures";
import { state, count, delay } from "./state";
import { buildTwinRewindHistory } from "../../src/lib/twin-rewind";
import { DIGITAL_ATHLETE_CALCULATION_VERSION } from "../../src/lib/digital-athlete.service";

function row(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    schema_version: "1.7",
    calculation_version: DIGITAL_ATHLETE_CALCULATION_VERSION,
    computed_at: new Date(Date.UTC(2026, 8, 26 - index, 21, 30)).toISOString(),
    source_window_start: "2026-08-25T21:30:00Z",
    source_window_end: new Date(Date.UTC(2026, 8, 26 - index, 21, 30)).toISOString(),
    state: {
      ...baseState,
      training: { ...baseState.training, totalVolumeLast28Days: index === 0 ? 4800 : 4200 },
      recovery: {
        ...baseState.recovery,
        latestReadinessScore: 72 - index * 2,
        averageSleepHoursLast7Days: 7.25,
      },
      body: { ...baseState.body, latestWeightKg: null },
      muscleLoad: [
        {
          muscleGroup: "chest",
          volumeKg: index === 0 ? 520 : 0,
          recoveryPct: 64 - index * 2,
          lastTrainedHoursAgo: 18,
        },
      ],
    },
  };
}
export async function getTwinRewindHistory() {
  count("getTwinRewindHistory");
  while (state.fail === "rewind-pending") await delay();
  if (state.fail === "rewind") throw new Error("UNTRUSTED_SYNTHETIC_REWIND_FAILURE");
  const scenario = new URLSearchParams(location.search).get("scenario");
  if (scenario === "empty") return buildTwinRewindHistory([]);
  if (scenario === "single") return buildTwinRewindHistory([row(0)]);
  const incompatible = { ...row(1), calculation_version: "older-calculation" };
  if (scenario === "excluded") return buildTwinRewindHistory([null, incompatible]);
  if (scenario === "bounded")
    return buildTwinRewindHistory(Array.from({ length: 13 }, (_, i) => row(i)));
  // Reverse input order exercises the real sorter. The intervening incompatible
  // state must never become the comparison partner.
  return buildTwinRewindHistory([row(3), row(2), incompatible, row(0), null]);
}
export async function getTwinEvidenceWindow({
  data,
}: {
  data: { olderAt: string; newerAt: string };
}) {
  count("getTwinEvidenceWindow");
  state.last.getTwinEvidenceWindow = data;
  return { events: [], omittedCount: 0, hasMore: false, limit: 30 };
}
