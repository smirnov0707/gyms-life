import { LabOverviewSchema, type LabDecision, type LabUnreadableSource } from "@/lib/lab.schema";
import { buildDecisionAccuracy } from "@/lib/decision-accuracy.engine";

/** Synthetic fixtures only. No user identity, actual workout or live service data. */
export function makeLabData(unreadable: LabUnreadableSource[] = [], empty = false) {
  const decisions: LabDecision[] = empty ? [] : Array.from({ length: 4 }, (_, index) => ({
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    decisionOn: "2026-10-01",
    action: "train_as_planned",
    basis: "current_checkin",
    status: index < 3 ? "completed" : "active",
    evidence: [],
    outcome: index < 3 ? "completed" : null,
    createdAt: "2026-10-01T09:00:00.000Z",
  }));
  return LabOverviewSchema.parse({
    hypotheses: [],
    hypothesisHistory: [],
    decisions,
    decisionAccuracy: buildDecisionAccuracy(decisions),
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 0,
      totalEvaluated: 0,
      totalPending: 0,
      minimumEvaluated: 8,
      models: [],
    },
    proactiveMemoryChanges: [],
    dataGaps: [],
    unreadable,
  });
}
