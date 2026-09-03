import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTodaysWorkoutData } from "./active-plan.service";
import { IanaTimeZoneSchema } from "./local-day";

const DayParam = z.object({
  day: z.coerce.number().int().min(1).optional(),
  timeZone: IanaTimeZoneSchema.optional(),
});

export const getTodaysWorkout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DayParam.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      data.timeZone ??
      (data.day === undefined
        ? await loadPersistedProfileTimeZone(context.supabase, context.userId)
        : undefined);
    return getTodaysWorkoutData(context.supabase, context.userId, data.day, timeZone);
  });
