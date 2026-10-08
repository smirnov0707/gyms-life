import { ManualEnduranceSubmissionSchema } from "@/lib/endurance-submission.schema";
import { offlineIdentity } from "@/lib/offline-identity";
import type { EnduranceRaceEnrichmentResult } from "@/lib/endurance-race-enrichment.service";
import { ManualEnduranceActivitySchema } from "@/lib/endurance-activity.schema";
import { buildEnduranceTrainingCredit } from "@/lib/endurance-training-credit.engine";

// Account data and writes are synthetic; this module never creates a live client.
const query = new URLSearchParams(location.search);
const sessionId = "20000000-0000-4000-8000-000000000002";
const goalId = "30000000-0000-4000-8000-000000000003";
const state = {
  saves: 0,
  lastSubmissionId: "",
  submissionIds: [] as string[],
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
async function logLegacyActivity({ data }: { data: unknown }) {
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
  if (query.get("retry") === "needs-confirmation") return outcome("needs_confirmation");
  if (query.get("retry") === "load-unavailable") {
    const unavailable: EnduranceRaceEnrichmentResult = {
      ...outcome("unavailable"),
      raceEnrichment: { status: "unavailable", linked: false, retryable: true, stage: "load" },
    };
    return unavailable;
  }
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

// Synthetic persistence survives reload; these records never reach a real account.
const persistedKey = "synthetic-manual-endurance-submission";
let storedReply: Awaited<ReturnType<typeof logLegacyActivity>> | null = null;
const prior = sessionStorage.getItem(persistedKey);
if (prior) {
  const parsed = JSON.parse(prior);
  storedReply = parsed.reply;
  Object.assign(state, parsed.state);
}
export async function logEnduranceActivity({ data }: { data: unknown }) {
  const submission = ManualEnduranceSubmissionSchema.parse(data);
  state.submissionIds.push(submission.submissionId);
  state.lastSubmissionId = submission.submissionId;
  let disposition: "created" | "replayed";
  if (storedReply?.session.id === submission.submissionId) {
    state.saves++;
    disposition = "replayed";
    await delay();
  } else {
    disposition = "created";
    const logged = await logLegacyActivity({ data: submission.activity });
    storedReply = { ...logged, session: { ...logged.session, id: submission.submissionId } };
  }
  sessionStorage.setItem(persistedKey, JSON.stringify({ reply: storedReply, state }));
  if (query.get("scenario") === "initial-response-lost" && disposition === "created")
    throw new Error("Synthetic response lost after primary commit");
  if (query.get("scenario") === "identity-changed")
    offlineIdentity.set("99999999-9999-4999-8999-999999999999");
  if (!storedReply) throw new Error("Synthetic reply missing");
  return {
    ...storedReply,
    manualSubmission: {
      ownerId: query.get("scenario") === "foreign-receipt" ? goalId : submission.ownerId,
      submissionId: submission.submissionId,
      disposition,
    },
  };
}
