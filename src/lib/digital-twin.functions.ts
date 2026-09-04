import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns the signed-in user's real Digital Twin snapshot. */
export const getTwinSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { loadTwinSnapshot } = await import("./digital-twin.service");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    return loadTwinSnapshot(context.supabase, context.userId, timeZone);
  });
