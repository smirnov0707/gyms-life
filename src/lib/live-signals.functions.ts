import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** The signed-in athlete's own measured signals. Never anybody else's. */
export const getLiveSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadLiveSignals } = await import("./live-signals.server");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const { dayInTimeZone } = await import("./local-day");
    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    // The athlete's day, not the server's: a reading from last night is
    // "today" in Vilnius and "yesterday" in UTC for three hours every morning.
    return loadLiveSignals(context.supabase, context.userId, dayInTimeZone(new Date(), timeZone));
  });
