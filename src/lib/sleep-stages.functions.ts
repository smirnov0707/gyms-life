import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayInTimeZone, dayOffset, IanaTimeZoneSchema } from "./local-day";
import { buildSleepNight, type SleepNight, type SleepStageRow } from "./sleep-stages.engine";

/**
 * How far back a night may be and still be worth showing.
 *
 * Wide enough that a phone which failed to sync for a week still has something
 * to show, and the panel says how old the night is either way — the alternative
 * is an empty panel that reads as "you have never slept".
 */
const WINDOW_DAYS = 14;

export const getSleepNight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ data, context }): Promise<SleepNight> => {
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone = data ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    const today = dayInTimeZone(new Date(), timeZone);

    const { data: rows, error } = await context.supabase
      .from("health_samples")
      .select(
        "sample_on, source, sleep_hours, sleep_awake_minutes, sleep_rem_minutes, sleep_deep_minutes, sleep_core_minutes",
      )
      .eq("user_id", context.userId)
      .gte("sample_on", dayOffset(today, -WINDOW_DAYS))
      .order("sample_on", { ascending: false })
      .limit(WINDOW_DAYS * 2);

    // Null rather than an empty list on a failed read: "no watch has ever sent
    // a night" and "we could not read your nights" render identically unless
    // the difference survives this far.
    return buildSleepNight({
      rows: error ? null : ((rows ?? []) as SleepStageRow[]),
      today,
    });
  });
