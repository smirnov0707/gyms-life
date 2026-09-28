// Synthetic service boundary. The real schema validates every fixture response.
import { state, count } from "./state";
import { WeeklyIntelligenceReviewSchema } from "../../src/lib/weekly-intelligence.schema";
export async function getWeeklyIntelligenceReview({ data }: { data: string }) {
  count("getWeeklyIntelligenceReview");
  state.last.weeklyTimeZone = data;
  while (state.fail === "weekly-pending") await new Promise((resolve) => setTimeout(resolve, 100));
  if (state.fail === "weekly") throw new Error("UNTRUSTED_SYNTHETIC_FAILURE_DETAILS");
  const query = new URLSearchParams(location.search);
  const scenario =
    typeof state.last.weeklyScenario === "string"
      ? state.last.weeklyScenario
      : query.get("scenario");
  const empty = scenario === "empty",
    unreadable = scenario === "unreadable";
  const missingTraining = scenario === "partial-training",
    missingRecovery = scenario === "partial-recovery";
  const discoveries = [
    {
      type: "training_pattern",
      content: "UNTRUSTED_SYNTHETIC_SOURCE_TEXT",
      source: "calculated",
      evidenceState: "calculated_threshold_met",
      importance: 0.9,
      calculatedValue: { kind: "training_consistency_28d", sessionsLast28Days: 12, windowDays: 28 },
    },
    {
      type: "recovery_pattern",
      content: "UNTRUSTED_SYNTHETIC_SOURCE_TEXT",
      source: "calculated",
      evidenceState: "calculated_threshold_met",
      importance: 0.8,
      calculatedValue: {
        kind: "recovery_low_7d",
        averageReadiness: 52.5,
        checkinsLast7Days: 4,
        windowDays: 7,
      },
    },
    {
      type: "nutrition_pattern",
      content: "UNTRUSTED_SYNTHETIC_SOURCE_TEXT",
      source: "calculated",
      evidenceState: "calculated_threshold_met",
      importance: 0.7,
      calculatedValue: { kind: "nutrition_logging_14d", loggedDaysLast14Days: 11, windowDays: 14 },
    },
  ];
  return WeeklyIntelligenceReviewSchema.parse({
    status: unreadable
      ? "unreadable"
      : empty || missingTraining || missingRecovery
        ? "learning"
        : "ready",
    thisWeek: {
      completedWorkouts: empty || missingTraining ? 0 : 3,
      readinessCheckins: empty || missingRecovery ? 0 : 4,
      averageReadiness: empty || missingRecovery || scenario === "no-average" ? null : 52.5,
    },
    discoveries: empty || unreadable || missingTraining || missingRecovery ? [] : discoveries,
    nextAction: { action: query.get("action") ?? (empty ? "start_training" : "open_today") },
    stillLearning: empty
      ? ["no_completed_workouts_28d", "no_recovery_checkins_7d", "no_nutrition_logs_14d"]
      : missingTraining
        ? ["training_data_unavailable"]
        : missingRecovery
          ? ["recovery_data_unavailable"]
          : unreadable
            ? []
            : ["no_body_measurements_30d"],
  });
}
