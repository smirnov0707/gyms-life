import type { EnduranceRaceEnrichmentResult } from "@/lib/endurance-race-enrichment.service";
import { ManualEnduranceActivitySchema } from "@/lib/endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "@/lib/endurance-training-credit.engine";

// Account data and writes are synthetic; this module never creates a live client.
const query = new URLSearchParams(location.search);
const sessionId = "20000000-0000-4000-8000-000000000002";
const goalId = "30000000-0000-4000-8000-000000000003";
const state = {
  saves: 0,
  records: 0,
  retries: 0,
  confirmations: 0,
  refreshes: 0,
  trainingEvents: 0,
  enduranceEvents: 0,
  linked: false,
  lastRetry: null as unknown,
};
Object.assign(window, { __enduranceLog: state });
window.addEventListener("gymslife:training-completed", () => state.trainingEvents++);
window.addEventListener("gymslife:endurance-updated", () => state.enduranceEvents++);
const delay = () => new Promise((resolve) => setTimeout(resolve, 150));
function outcome(
  status: "matched" | "unavailable" | "needs_confirmation",
  linked = false,
): EnduranceRaceEnrichmentResult {
  return {
    raceMatch:
      status === "needs_confirmation"
        ? {
            status,
            plannedIndex: 0,
            plannedSessionKey: "w1-s1",
            score: 0.75,
            reason: "distance_only",
            raceGoalId: goalId,
            intent: "easy",
          }
        : null,
    raceIntelligence: null,
    raceEnrichment:
      status === "unavailable"
        ? { status, linked, retryable: true, stage: linked ? "refresh" : "classify" }
        : { status, linked: status === "matched", retryable: false },
  };
}
export async function logEnduranceActivity({ data }: { data: unknown }) {
  state.saves++;
  const activity = ManualEnduranceActivitySchema.parse(data);
  await delay();
  if (query.get("scenario") === "save-fails") throw new Error("Synthetic primary failure");
  state.records++;
  const scenario = query.get("scenario");
  state.linked = scenario === "linked-refresh-fails" || scenario === "matched";
  return {
    session: {
      id: sessionId,
      started_at: activity.startedAt,
      finished_at: new Date().toISOString(),
    },
    activity,
    credit: buildEnduranceTrainingCredit(activity),
    ...outcome(
      scenario === "needs-confirmation"
        ? "needs_confirmation"
        : scenario === "matched"
          ? "matched"
          : "unavailable",
      state.linked,
    ),
  };
}
export async function retryEnduranceRaceEnrichmentFn({ data }: { data: unknown }) {
  state.retries++;
  state.lastRetry = data;
  await delay();
  if (query.get("scenario") === "retry-fails") throw new Error("Synthetic secondary failure");
  state.linked = true;
  return outcome("matched", true);
}
export async function confirmRaceSessionMatchFn() {
  state.confirmations++;
  state.linked = true;
  await delay();
  if (query.get("confirm") === "response-lost")
    throw new Error("Synthetic lost response after commit");
  return { id: sessionId };
}
export async function refreshRunLogFixture() {
  state.refreshes++;
  if (query.get("refresh") === "fail") throw new Error("Synthetic screen refresh failure");
}
