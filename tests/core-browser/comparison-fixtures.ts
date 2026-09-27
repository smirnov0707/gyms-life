import { baseState } from "./trend-fixtures";
import { buildTwinRewindHistory } from "../../src/lib/twin-rewind";
import { buildTwinEvidenceWindow } from "../../src/lib/twin-evidence-window";
import { DIGITAL_ATHLETE_CALCULATION_VERSION } from "../../src/lib/digital-athlete.service";
export function comparisonPoints(alternate = false) {
  const scenario = new URLSearchParams(location.search).get("scenario");
  const rows = [0, 1].map((index) => ({
    id: `00000000-0000-4000-8000-${String((alternate ? 200 : 100) + index).padStart(12, "0")}`,
    schema_version: "1.7",
    calculation_version:
      scenario === "incompatible" && index === 0 ? "earlier" : DIGITAL_ATHLETE_CALCULATION_VERSION,
    computed_at: new Date(Date.UTC(2026, 8, (alternate ? 24 : 26) + index, 21, 30)).toISOString(),
    source_window_start: null,
    source_window_end: null,
    state: {
      ...baseState,
      muscleLoad:
        scenario === "unknown"
          ? []
          : [
              {
                muscleGroup: "chest",
                recoveryPct: index === 0 ? 40 : 64,
                volumeKg: index === 0 ? 0 : 520,
                lastTrainedHoursAgo: 18,
              },
              {
                muscleGroup: "shoulders",
                recoveryPct: index === 0 ? 75 : 48,
                volumeKg: index === 0 ? 240 : 140,
                lastTrainedHoursAgo: 18,
              },
              { muscleGroup: "glutes", recoveryPct: 60, volumeKg: 0, lastTrainedHoursAgo: 18 },
              { muscleGroup: "cardio", recoveryPct: 70, volumeKg: 0, lastTrainedHoursAgo: 18 },
            ],
    },
  }));
  const history = buildTwinRewindHistory(rows);
  const newer = history.points[0],
    older = history.points[1];
  if (!newer || !older) throw new Error("Invalid synthetic comparison pair");
  return {
    newer,
    older:
      scenario === "equal"
        ? { ...older, computedAt: newer.computedAt }
        : scenario === "reversed"
          ? { ...older, computedAt: "2026-09-30T21:30:00.000Z" }
          : older,
  };
}
export function evidenceFixture(input: { olderAt: string; newerAt: string }) {
  const scenario = new URLSearchParams(location.search).get("scenario");
  const end = Date.parse(input.newerAt),
    start = Date.parse(input.olderAt);
  const row = (index: number, overrides: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    event_type: "workout_completed",
    occurred_at: new Date(end - index * 60000).toISOString(),
    created_at: new Date(end + 60000).toISOString(),
    timezone: "Europe/Vilnius",
    provenance: "user_reported",
    quality: "unknown",
    source_system: "gymslife",
    source_table: "workout_sessions",
    source_reference: `synthetic-${index}`,
    schema_version: "1.0",
    ...overrides,
  });
  const omitted = [
    null,
    row(8, { occurred_at: input.olderAt }),
    row(9, { occurred_at: new Date(end + 1).toISOString() }),
  ];
  if (scenario === "empty") return buildTwinEvidenceWindow(input, []);
  if (scenario === "excluded") return buildTwinEvidenceWindow(input, omitted);
  if (scenario === "bounded")
    return buildTwinEvidenceWindow(
      input,
      Array.from({ length: 31 }, (_, i) => row(i)),
    );
  return buildTwinEvidenceWindow(input, [
    row(0),
    row(1, {
      event_type: "checkin_recorded",
      timezone: "America/Los_Angeles",
      source_table: "daily_checkins",
    }),
    row(2, {
      event_type: "decision_recorded",
      provenance: "calculated",
      source_table: "daily_decisions",
    }),
    row(3, {
      event_type: "unknown-kind",
      timezone: "Bad/Zone",
      provenance: "unknown-origin",
      source_table: null,
      occurred_at: new Date(start + 1000).toISOString(),
    }),
    ...omitted,
  ]);
}
