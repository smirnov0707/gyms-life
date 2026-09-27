import { LabOverviewSchema, type LabHypothesisTransition } from "../../src/lib/lab.schema";
import { AthleteHypothesisSchema } from "../../src/lib/athlete-hypothesis.schema";
import { state, count } from "./state";

/** Isolated service responses; production evaluators still decide changes and eligibility. */
export async function getLabOverview({ data }: { data: string }) {
  count("getLabOverview");
  state.last["getLabOverview"] = { timeZone: data };
  while (state.fail === "memory-pending") await new Promise((resolve) => setTimeout(resolve, 40));
  if (state.fail === "memory") throw new Error("UNTRUSTED_MEMORY_PROVIDER_DETAIL");
  const scenario = new URLSearchParams(location.search).get("scenario");
  const response = AthleteHypothesisSchema.parse({
    id: "training-response-repeated-low-feeling",
    domain: "training_response",
    status: "supported",
    statementKey: "athlete.hypothesis.trainingResponse.repeatedLowFeeling",
    evidence: [
      { key: "rated_sessions_28d", value: 7, unit: "sessions", source: "user_reported" },
      { key: "recent_low_feeling_streak", value: 3, unit: "sessions", source: "user_reported" },
    ],
    evidenceCount: 7,
    minimumEvidenceCount: 6,
    canInfluenceDecision: true,
  });
  const behavior = AthleteHypothesisSchema.parse({
    id: "training-behavior-usual-day-fit",
    domain: "training_behavior",
    status: "monitoring",
    statementKey: "athlete.hypothesis.trainingBehavior.usualDayFit",
    evidence: [
      { key: "usual_training_days_28d", value: 8, unit: "days", source: "calculated" },
      { key: "usual_day_completion_rate_28d", value: 0.625, unit: "ratio", source: "calculated" },
    ],
    evidenceCount: 8,
    minimumEvidenceCount: 8,
    canInfluenceDecision: false,
  });
  let hypotheses = [response, behavior];
  let history: LabHypothesisTransition[] = hypotheses
    .map((h) => ({
      ...h,
      hypothesisId: h.id,
      athleteStateSnapshotId: "00000000-0000-4000-8000-000000000099",
      domain: h.domain,
      previousStatus: "monitoring",
      status: h.status,
      evidenceCount: h.evidenceCount - 1,
      source: "deterministic",
      occurredAt: "2026-09-25T06:00:00.000Z",
    }))
    .map(({ id: _id, ...row }) => row);
  if (scenario === "empty" || scenario === "gap") {
    hypotheses = [];
    history = [];
  }
  if (scenario === "unanchored") history = [];
  if (scenario === "insufficient") {
    hypotheses = [
      AthleteHypothesisSchema.parse({
        ...response,
        status: "insufficient_evidence",
        evidenceCount: 4,
        canInfluenceDecision: false,
        evidence: [
          { key: "rated_sessions_28d", value: 4, unit: "sessions", source: "user_reported" },
        ],
      }),
    ];
    history = [];
  }
  if (scenario === "drift" && history[0])
    history[0] = { ...history[0], status: "monitoring", canInfluenceDecision: false };
  if (scenario === "definition" && history[0])
    history[0] = { ...history[0], statementKey: "UNTRUSTED_HISTORICAL_STATEMENT" };
  if (scenario === "broken" && history[0])
    history.push({
      ...history[0],
      status: "contradicted",
      canInfluenceDecision: false,
      previousStatus: "supported",
      occurredAt: "2026-09-24T06:00:00.000Z",
    });
  if (scenario === "unknown") {
    hypotheses = [
      AthleteHypothesisSchema.parse({
        ...behavior,
        statementKey: "UNTRUSTED_STATEMENT",
        evidence: [
          { key: "UNTRUSTED_METRIC", unit: "UNTRUSTED_UNIT", value: 17, source: "measured" },
        ],
      }),
    ];
    history = [];
  }
  return LabOverviewSchema.parse({
    hypotheses,
    hypothesisHistory: history,
    decisions: [],
    decisionAccuracy: {
      totalProposed: 0,
      totalAnswered: 0,
      totalFitting: 0,
      overallFitRate: null,
      minimumAnswered: 3,
      byBasis: [],
    },
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 0,
      totalEvaluated: 0,
      totalPending: 0,
      minimumEvaluated: 8,
      models: [],
    },
    dataGaps: scenario === "gap" ? ["no_recovery_checkins_7d"] : [],
    unreadable: [],
  });
}
