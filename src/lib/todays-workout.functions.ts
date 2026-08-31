import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActivePlan } from "./active-plan.functions";

const DayParam = z.object({ day: z.coerce.number().int().min(1).optional() });

export const getTodaysWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DayParam.parse(input ?? {}))
  .handler(async ({ data }) => {
    const result = await getActivePlan();
    if (result.status !== "READY") return result;

    const days = result.plan.data.days;
    const requestedDay = data.day;
    const day = requestedDay
      ? days.find((item) => item.day === requestedDay)
      : days[0];

    if (!day) return { status: "NO_WORKOUT" as const, plan: result.plan };

    return { status: "READY" as const, plan: result.plan, workout: day };
  });
