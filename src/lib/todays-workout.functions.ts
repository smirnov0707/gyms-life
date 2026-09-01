import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";

const DayParam = z.object({
  day: z.coerce.number().int().min(1).optional(),
});

export const getTodaysWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DayParam.parse(input ?? {}))
  .handler(async ({ data, context }) =>
    getTodaysWorkoutData(context.supabase, context.userId, data.day),
  );
