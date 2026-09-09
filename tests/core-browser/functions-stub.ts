// Synthetic service fixtures; all simulated writes stay in the isolated test state.
import { state, count, ids } from "./state";
export async function getActivePlan() {
  count("getActivePlan");
  if (state.fail === "training") throw new Error("Synthetic plan unavailable");
  return state.active
    ? {
        status: "READY",
        plan: {
          id: ids.TRAINING_ID,
          title: state.plan.title,
          goal: "lose_fat",
          weeks: 8,
          daysPerWeek: 3,
          data: state.plan,
        },
      }
    : { status: "NO_ACTIVE_PLAN" };
}
export async function getHydrationTarget() {
  return null;
}
export async function getHydrationIntake() {
  return { totalMl: 0, entries: [] };
}
export async function localizeMealPlan() {
  count("localizeMealPlan");
  if (!state.meal) throw new Error("No synthetic meal plan");
  return { plan: state.meal.data };
}

// Simulate a completed response in memory only. No external service is invoked.
export async function generatePlan({ data }: { data: unknown }) {
  count("generatePlan");
  state.last["generatePlan"] = data;
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (state.fail === "generate") throw new Error("Synthetic generation failure");
  return { planId: ids.TRAINING_ID, plan: state.plan };
}
export async function activatePlan({ data }: { data: { planId: string } }) {
  count("activatePlan");
  state.last["activatePlan"] = data;
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (state.fail === "activation") throw new Error("Synthetic activation failure");
  state.active = true;
  const { persist } = await import("./state");
  persist();
  return { ok: true, planId: ids.TRAINING_ID };
}

export async function generateMealPlan({ data }: { data: unknown }) {
  count("generateMealPlan");
  state.last["generateMealPlan"] = data;
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (state.fail === "generate") throw new Error("Synthetic generation failure");
  const { mealPlan } = await import("./fixtures");
  const request = data as { lang: string; mealsPerDay: number; kcalTarget?: number };
  const plan = { ...structuredClone(mealPlan), title: "Generated synthetic meal plan" };
  state.meal = {
    id: ids.MEAL_ID,
    user_id: ids.USER,
    data: plan,
    lang: request.lang,
    created_at: ids.VERSION,
    updated_at: ids.VERSION,
    is_active: true,
    kcal_target: plan.kcal_target,
    protein_target: plan.protein_target,
    carbs_target: plan.carbs_target,
    fat_target: plan.fat_target,
  };
  const { persist } = await import("./state");
  persist();
  return { id: ids.MEAL_ID, plan, createdAt: ids.VERSION, updatedAt: ids.VERSION };
}
export async function adaptMealPlan({ data }: { data: unknown }) {
  count("adaptMealPlan");
  state.last["adaptMealPlan"] = data;
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (state.fail === "adapt" || !state.meal) throw new Error("Synthetic adaptation failure");
  const current = state.meal;
  const request = data as { planId: string; version: string; fromDay: number };
  if (request.planId !== current.id || request.version !== current.updated_at)
    throw new Error("Synthetic stale revision");
  current.data = {
    ...current.data,
    title: "Adapted synthetic meal plan",
    adapted_from_day: request.fromDay,
    adaptation_note: "Synthetic adjustment",
    adapted_at: new Date().toISOString(),
  };
  current.updated_at = new Date().toISOString();
  const { persist } = await import("./state");
  persist();
  return {
    id: current.id,
    updatedAt: current.updated_at,
    lang: current.lang,
    plan: current.data,
    rationale: "Synthetic adjustment",
    days: [request.fromDay],
  };
}

export async function logMeal({ data }: { data: { description: string; timeZone: string } }) {
  count("logMeal");
  state.last["logMeal"] = data;
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (state.fail === "saveFood") throw new Error("Synthetic food save failure");
  const { dayInTimeZone } = await import("../../src/lib/local-day");
  const row = {
    id: crypto.randomUUID(),
    user_id: ids.USER,
    logged_on: dayInTimeZone(new Date(), data.timeZone),
    created_at: new Date().toISOString(),
    food_name: data.description,
    description: data.description,
    calories: 500,
    protein: 25,
    carbs: 60,
    fat: 18,
    source: "text_estimate",
    note: null,
  };
  state.foods.push(row);
  const { persist } = await import("./state");
  persist();
  return row;
}

export {
  getTodaysWorkout,
  startWorkout,
  logWorkoutSet,
  finishWorkout,
  recordWorkoutReflection,
} from "./workout-functions";

// Controlled model-response boundaries. No microphone audio leaves this fixture.
export async function getSmartWarmup() {
  count("smartWarmup");
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (state.fail === "warmup") throw new Error("AI_PROVIDER_UNAVAILABLE");
  return {
    headline: "Synthetic user-requested warm-up",
    minutes: 5,
    readiness: null,
    drills: [
      {
        slug: "arm-circles",
        name: "Synthetic arm circles",
        dose: "30 s",
        focus: "Synthetic",
        why: "Synthetic test response",
      },
      {
        slug: "bodyweight-squats",
        name: "Synthetic squats",
        dose: "5 reps",
        focus: "Synthetic",
        why: "Synthetic test response",
      },
    ],
  };
}
export async function parseVoiceWorkoutLog({ data }: { data: unknown }) {
  count("voiceParse");
  state.last["voiceParse"] = data;
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (state.fail === "voice") throw new Error("AI_PROVIDER_UNAVAILABLE");
  return {
    ok: true as const,
    transcription: "Synthetic squat eight repetitions",
    data: {
      exerciseName: "Synthetic squat",
      reps: 8,
      weightKg: null,
      rpe: null,
      suggestedRestSeconds: null,
      coachFeedback: "",
    },
  };
}

export async function identifyOwnedOfflineSessions({
  data,
}: {
  data: { ownerId: string; sessionIds: string[] };
}) {
  if (data.ownerId !== ids.USER) throw new Error("OFFLINE_IDENTITY_CHANGED");
  return {
    ownerId: ids.USER,
    sessionIds: data.sessionIds.filter((id) => id === "55555555-5555-4555-8555-555555555555"),
  };
}
export async function syncOfflineWorkoutSet({
  data,
}: {
  data: import("../../src/lib/offline-contract").OfflineSyncRequest;
}) {
  if (data.ownerId !== ids.USER) throw new Error("OFFLINE_IDENTITY_CHANGED");
  const { logWorkoutSet } = await import("./workout-functions");
  await logWorkoutSet({ data: data.data });
  return {
    status: "acknowledged" as const,
    ownerId: ids.USER,
    clientId: data.clientId,
    serverSetId: "77777777-7777-4777-8777-777777777777",
    data: data.data,
  };
}
