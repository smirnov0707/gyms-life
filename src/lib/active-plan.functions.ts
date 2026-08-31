import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanData } from "./plan-types";

const PlanExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sets: z.coerce.number().int().positive(),
  reps: z.union([z.string(), z.number()]).transform(String),
  rest_seconds: z.coerce.number().int().nonnegative(),
  notes: z.string().optional().default(""),
});

const PlanDaySchema = z.object({
  day: z.coerce.number().int().positive(),
  title: z.string(),
  focus: z.string(),
  warmup: z.string(),
  cooldown: z.string(),
  estimated_minutes: z.coerce.number().int().positive(),
  exercises: z.array(PlanExerciseSchema),
});

const PlanDataSchema = z.object({
  title: z.string(),
  summary: z.string(),
  weeks: z.coerce.number().int().positive(),
  progression: z.string(),
  nutrition: z.string(),
  days: z.array(PlanDaySchema),
});

export type ActiveTrainingPlan = {
  id: string;
  title: string;
  goal: string | null;
  weeks: number;
  daysPerWeek: number;
  createdAt: string;
  data: PlanData;
};

export type ActivePlanState =
  | { status: "NO_ACTIVE_PLAN" }
  | { status: "READY"; plan: ActiveTrainingPlan }
  | { status: "INVALID_PLAN"; planId: string; message: string };

type ActivePlanRow = {
  id: string;
  title: string;
  goal: string | null;
  weeks: number;
  days_per_week: number;
  created_at: string;
  data: unknown;
};

export function normalizeActivePlan(row: ActivePlanRow): ActiveTrainingPlan | ActivePlanState {
  const parsed = PlanDataSchema.safeParse(row.data);

  if (!parsed.success) {
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
    data: parsed.data,
  };
}

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivePlanState> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("plans")
      .select("id, title, goal, weeks, days_per_week, created_at, data")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Active plan lookup failed: ${error.message}`);
    }

    if (!data) {
      return { status: "NO_ACTIVE_PLAN" };
    }

    const normalized = normalizeActivePlan(data as ActivePlanRow);

    if ("status" in normalized) {
      return normalized;
    }

    return { status: "READY", plan: normalized };
  });
