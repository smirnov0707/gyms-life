import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadHydrationIntake, loadHydrationTarget } from "./hydration.service";
import {
  HYDRATION_MAX_ENTRY_ML,
  type HydrationIntake,
  type HydrationTarget,
} from "./hydration.schema";
import { IanaTimeZoneSchema, dayInTimeZone } from "./local-day";

/** Today's fluid target, derived from the athlete's own logged evidence. */
export const getHydrationTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(({ data, context }): Promise<HydrationTarget> =>
    loadHydrationTarget(context.supabase, context.userId, data ?? "UTC"),
  );

/** Today's intake so far. */
export const getHydrationIntake = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(({ data, context }): Promise<HydrationIntake> =>
    loadHydrationIntake(context.supabase, context.userId, data ?? "UTC"),
  );

const LogHydrationInput = z
  .object({
    amountMl: z.number().int().positive().max(HYDRATION_MAX_ENTRY_ML),
    timeZone: IanaTimeZoneSchema.optional(),
  })
  .strict();

/** Records one drink. Returns the day's new total so the UI never guesses. */
export const logHydration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => LogHydrationInput.parse(input))
  .handler(async ({ data, context }): Promise<HydrationIntake> => {
    const { supabase, userId } = context;
    const timeZone = data.timeZone ?? "UTC";

    const { error } = await supabase.from("hydration_logs").insert({
      user_id: userId,
      logged_on: dayInTimeZone(new Date(), timeZone),
      amount_ml: data.amountMl,
    });
    if (error) throw new Error("Could not save hydration: " + error.message);

    return loadHydrationIntake(supabase, userId, timeZone);
  });

/** Clears today's entries — the reset the widget has always offered. */
export const clearHydrationToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<HydrationIntake> => {
    const { supabase, userId } = context;
    const timeZone = data ?? "UTC";

    const { error } = await supabase
      .from("hydration_logs")
      .delete()
      .eq("user_id", userId)
      .eq("logged_on", dayInTimeZone(new Date(), timeZone));
    if (error) throw new Error("Could not clear hydration: " + error.message);

    return loadHydrationIntake(supabase, userId, timeZone);
  });
