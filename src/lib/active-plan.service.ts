import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Tables } from "@/integrations/supabase/types";
import {
  parseStoredTrainingPlan,
  type TrainingPlanData,
  type TrainingPlanDay,
} from "./training-plan.schema";
import { IanaTimeZoneSchema, dayBoundsInTimeZone, dayInTimeZone, dayOffset } from "./local-day";

const ACTIVE_PLAN_SELECT = "id, title, goal, weeks, days_per_week, created_at, data";
const PlanDaysPerWeekSchema = z.number().int().min(1).max(7);
const PlanWeeksSchema = z.number().int().min(1).max(104);

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
      status: "WEEKLY_TARGET_REACHED";
      plan: ActiveTrainingPlan;
      nextWorkout: TrainingPlanDay;
      completedSessionsLast7Days: number;
    }
  | {
      status: "READY";
      plan: ActiveTrainingPlan;
      workout: TrainingPlanDay;
    };

export type ActivePlanWorkoutProgressState =
  | ActivePlanUnavailableState
  | {
      status: "READY";
      plan: ActiveTrainingPlan;
      nextWorkout: TrainingPlanDay | null;
      completedSessionsLast7Days: number;
      hasOpenWorkout: boolean;
    };

export type ActivePlanWorkoutPosition = {
  openDayIndex: number | null;
  lastCompletedDayIndex: number | null;
};

const OpenPlanSessionSourceSchema = z
  .object({
    day_index: z.number().int().nonnegative().nullable(),
    started_at: z.string().datetime({ offset: true }),
  })
  .strict();

const CompletedPlanSessionSourceSchema = z
  .object({
    day_index: z.number().int().nonnegative().nullable(),
    finished_at: z.string().datetime({ offset: true }),
  })
  .strict();

/**
 * `plans` keeps quick-query metadata alongside the structured program JSON.
 * Both representations must agree before an active plan can drive sequence or
 * frequency decisions. The database remains the raw source; this is the
 * validation boundary that prevents inconsistent legacy rows from becoming a
 * domain plan.
 */
function matchesActivePlanMetadata(
  data: TrainingPlanData,
  weeks: number,
  daysPerWeek: number,
): boolean {
  if (data.weeks !== weeks || data.days.length !== daysPerWeek) return false;
  const dayNumbers = data.days.map((day) => day.day).sort((left, right) => left - right);
  return dayNumbers.every((day, index) => day === index + 1);
}

export function normalizeActivePlan(
  row: ActivePlanRow,
): ActiveTrainingPlan | ActivePlanUnavailableState {
  const data = parseStoredTrainingPlan(row.data);
  const daysPerWeek = PlanDaysPerWeekSchema.safeParse(row.days_per_week);
  const weeks = PlanWeeksSchema.safeParse(row.weeks);

  if (
    !data ||
    !daysPerWeek.success ||
    !weeks.success ||
    !matchesActivePlanMetadata(data, weeks.data, daysPerWeek.data)
  ) {
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
    weeks: weeks.data,
    daysPerWeek: daysPerWeek.data,
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

/**
 * Selects the next program day from validated session history. An unfinished
 * session always wins; otherwise the sequence advances from the last finished
 * day and wraps only after the final program day. Calendar days are not
 * invented because an athlete has not yet supplied a fixed weekly schedule.
 */
export function selectNextPlanWorkout(
  plan: ActiveTrainingPlan,
  position: ActivePlanWorkoutPosition,
): TrainingPlanDay | null {
  const days = [...plan.data.days].sort((left, right) => left.day - right.day);
  if (days.length === 0) return null;

  const activeDayIndex = position.openDayIndex ?? position.lastCompletedDayIndex;
  if (activeDayIndex === null) return days[0] ?? null;

  const currentPosition = days.findIndex((day) => day.day === activeDayIndex + 1);
  if (currentPosition === -1) return days[0] ?? null;

  if (position.openDayIndex !== null) return days[currentPosition] ?? null;
  return days[(currentPosition + 1) % days.length] ?? null;
}

async function loadActivePlanWorkoutProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  plan: ActiveTrainingPlan,
  timeZone: string,
  now: Date,
): Promise<Omit<Extract<ActivePlanWorkoutProgressState, { status: "READY" }>, "status">> {
  const zone = IanaTimeZoneSchema.parse(timeZone);
  const today = dayInTimeZone(now, zone);
  const { start } = dayBoundsInTimeZone(dayOffset(today, -6), zone);
  const { end } = dayBoundsInTimeZone(today, zone);

  const [openResult, completedResult, countResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("day_index, started_at")
      .eq("user_id", userId)
      .eq("plan_id", plan.id)
      .is("finished_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("day_index, finished_at")
      .eq("user_id", userId)
      .eq("plan_id", plan.id)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("plan_id", plan.id)
      .not("finished_at", "is", null)
      .gte("finished_at", start)
      .lt("finished_at", end),
  ]);

  if (openResult.error) throw new Error("Open active-plan workout lookup failed.");
  if (completedResult.error) throw new Error("Completed active-plan workout lookup failed.");
  if (countResult.error) throw new Error("Active-plan workout frequency lookup failed.");

  const open =
    openResult.data === null ? null : OpenPlanSessionSourceSchema.safeParse(openResult.data);
  const completed =
    completedResult.data === null
      ? null
      : CompletedPlanSessionSourceSchema.safeParse(completedResult.data);
  if (open !== null && !open.success) throw new Error("Open active-plan workout is invalid.");
  if (completed !== null && !completed.success) {
    throw new Error("Completed active-plan workout is invalid.");
  }

  const completedSessionsLast7Days = countResult.count ?? 0;
  if (!Number.isSafeInteger(completedSessionsLast7Days) || completedSessionsLast7Days < 0) {
    throw new Error("Active-plan workout frequency is invalid.");
  }

  return {
    plan,
    nextWorkout: selectNextPlanWorkout(plan, {
      openDayIndex: open?.data.day_index ?? null,
      lastCompletedDayIndex: completed?.data.day_index ?? null,
    }),
    completedSessionsLast7Days,
    hasOpenWorkout: open !== null,
  };
}

/**
 * The one canonical active-plan progress read used by Today surfaces. It
 * separates a user's real session sequence from an unsupplied weekly calendar
 * while still enforcing the active plan's rolling seven-day frequency target.
 */
export async function getActivePlanWorkoutProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<ActivePlanWorkoutProgressState> {
  const activePlan = await getActivePlanData(supabase, userId);
  if (activePlan.status !== "READY") return activePlan;

  return {
    status: "READY",
    ...(await loadActivePlanWorkoutProgress(supabase, userId, activePlan.plan, timeZone, now)),
  };
}

export async function getTodaysWorkoutData(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestedDay?: number,
  timeZone?: string,
): Promise<TodaysWorkoutState> {
  const activePlan = await getActivePlanData(supabase, userId);

  if (activePlan.status !== "READY") {
    return activePlan;
  }

  if (requestedDay !== undefined) {
    const workout = activePlan.plan.data.days.find((day) => day.day === requestedDay);
    if (!workout) return { status: "NO_WORKOUT", plan: activePlan.plan };
    return { status: "READY", plan: activePlan.plan, workout };
  }

  if (timeZone === undefined) throw new Error("A calendar time zone is required for next workout.");
  const progress = await loadActivePlanWorkoutProgress(
    supabase,
    userId,
    activePlan.plan,
    timeZone,
    new Date(),
  );
  const workout = progress.nextWorkout;

  if (!workout) {
    return { status: "NO_WORKOUT", plan: progress.plan };
  }

  if (
    !progress.hasOpenWorkout &&
    progress.completedSessionsLast7Days >= progress.plan.daysPerWeek
  ) {
    return {
      status: "WEEKLY_TARGET_REACHED",
      plan: progress.plan,
      nextWorkout: workout,
      completedSessionsLast7Days: progress.completedSessionsLast7Days,
    };
  }

  return {
    status: "READY",
    plan: progress.plan,
    workout,
  };
}
