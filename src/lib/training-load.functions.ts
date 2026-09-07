import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayBoundsInTimeZone, dayInTimeZone, dayOffset, IanaTimeZoneSchema } from "./local-day";
import {
  buildTrainingLoad,
  TRAINING_LOAD_WEEK_DAYS,
  type TrainingLoad,
  type TrainingLoadSet,
} from "./training-load.engine";

/**
 * Two weeks of completed sets, windowed by when the training happened rather
 * than when the row was written — an offline set delivered days later belongs
 * to the day it was performed, not the day it arrived.
 */
export const getTrainingLoad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<TrainingLoad> => {
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone = data ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));

    const today = dayInTimeZone(new Date(), timeZone);
    const from = dayOffset(today, -(TRAINING_LOAD_WEEK_DAYS * 2 - 1));
    const { start } = dayBoundsInTimeZone(from, timeZone);
    const { end } = dayBoundsInTimeZone(today, timeZone);

    const { data: rows, error } = await context.supabase
      .from("set_logs")
      .select("performed_at, reps, weight_kg, done")
      .eq("user_id", context.userId)
      .gte("performed_at", start)
      .lt("performed_at", end)
      .limit(4000);

    return buildTrainingLoad({
      // Null, not an empty list: a week that could not be read is not a week
      // without training, and the panel says which it is looking at.
      sets: error ? null : ((rows ?? []) as TrainingLoadSet[]),
      today,
      dayOf: (instant) => {
        const parsed = new Date(instant);
        return Number.isNaN(parsed.getTime()) ? null : dayInTimeZone(parsed, timeZone);
      },
      shiftDay: dayOffset,
      // The read above always reaches back a full fortnight, so last week is
      // covered whenever the athlete has been here that long.
      coversLastWeek: true,
    });
  });
