import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  parseStoredTrainingPlan,
  type TrainingPlanData,
  type TrainingPlanDay,
} from "./training-plan.schema";

const ACTIVE_PLAN_SELECT = "id, title, goal, weeks, days_per_week, created_at, data";

export type ActivePlanRow = Pick<
  Tables<"plans">,
  "id" | "title" | "goal" | "weeks" | "days_per_week" | "created_at" | "data"
>;

export type ActiveTrainingPlan = {
  id: string;
  title: string;
  goal: string | null;
  weeks: number;
  daysPerWeek: number;
  createdAt: string;
  data: TrainingPlanData;
};

export type ActivePlanState =
  | { status: "NO_ACTIVE_PLAN" }
  | { status: "READY"; plan: ActiveTrainingPlan }
  | { status: "INVALID_PLAN"; planId: string; message: string };

type ActivePlanUnavailableState = Exclude<ActivePlanState, { status: "READY" }>;

export type TodaysWorkoutState =
  | ActivePlanUnavailableState
  | { status: "NO_WORKOUT"; plan: ActiveTrainingPlan }
  | {
      status: "READY";
      plan: ActiveTrainingPlan;
      workout: TrainingPlanDay;
    };

export function normalizeActivePlan(
  row: ActivePlanRow,
): ActiveTrainingPlan | ActivePlanUnavailableState {
  const data = parseStoredTrainingPlan(row.data);

  if (!data) {
    return {
      status: "INVALID_PLAN",
      planId: row.id,
      message: "Active program data is invalid or incomplete.",
    };
  }

  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    weeks: row.weeks,
    daysPerWeek: row.days_per_week,
    createdAt: row.created_at,
    data,
  };
}

export async function getActivePlanData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ActivePlanState> {
  const { data, error } = await supabase
    .from("plans")
    .select(ACTIVE_PLAN_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Active plan lookup failed: " + error.message);
  }

  if (!data) {
    return { status: "NO_ACTIVE_PLAN" };
  }

  const plan = normalizeActivePlan(data);

  return "status" in plan ? plan : { status: "READY", plan };
}

export async function getTodaysWorkoutData(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestedDay?: number,
): Promise<TodaysWorkoutState> {
  const activePlan = await getActivePlanData(supabase, userId);

  if (activePlan.status !== "READY") {
    return activePlan;
  }

  const workout = requestedDay
    ? activePlan.plan.data.days.find((day) => day.day === requestedDay)
    : activePlan.plan.data.days[0];

  if (!workout) {
    return { status: "NO_WORKOUT", plan: activePlan.plan };
  }

  return {
    status: "READY",
    plan: activePlan.plan,
    workout,
  };
}
