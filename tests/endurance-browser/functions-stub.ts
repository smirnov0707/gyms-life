/** No account, database or payment calls. Every mutation stays in this page's memory. */
const query = new URLSearchParams(location.search);
const SESSION = "20000000-0000-4000-8000-000000000002";
const GOAL = "30000000-0000-4000-8000-000000000003";
export const state = {
  logCalls: 0,
  retryCalls: 0,
  confirmCalls: 0,
  savedSessions: 0,
  trainingEvents: 0,
  enduranceEvents: 0,
  refreshCalls: 0,
  retryIds: [] as string[],
  failSave: query.has("failSave"),
  failRetry: query.has("failRetry"),
  failRefresh: query.has("failRefresh"),
  phase: query.get("phase") === "insights" ? "insights" : "matching",
  confirmation: query.has("confirmation"),
};
Object.assign(window, { __endurance: state });
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
export async function logEnduranceActivity() {
  state.logCalls++;
  await pause();
  if (state.failSave) throw new Error("Synthetic refused insert");
  state.savedSessions++;
  return {
    session: { id: SESSION },
    raceIntelligence: null,
    raceSync: { status: "deferred", phase: state.phase },
    raceMatch:
      state.phase === "insights"
        ? { status: "already_linked", raceGoalId: GOAL, plannedSessionKey: "w1-s1", intent: "easy" }
        : null,
  };
}
export async function retryEnduranceRaceSync({ data }: { data: { workoutSessionId: string } }) {
  state.retryCalls++;
  state.retryIds.push(data.workoutSessionId);
  if (data.workoutSessionId !== SESSION) throw new Error("Wrong synthetic run ID");
  await pause();
  if (state.failRetry) throw new Error("Synthetic sync transport failure");
  return {
    raceIntelligence: null,
    raceSync: { status: state.confirmation ? "needs_confirmation" : "matched" },
    raceMatch: {
      status: state.confirmation ? "needs_confirmation" : "already_linked",
      raceGoalId: GOAL,
      plannedSessionKey: "w1-s1",
      intent: "easy",
    },
  };
}
export async function confirmRaceSessionMatchFn() {
  state.confirmCalls++;
  return { id: SESSION };
}
