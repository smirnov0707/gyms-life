import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/** Returns the user's transparent, validated Digital Athlete model. */
export const getAthleteModel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.default("UTC").parse(input))
  .handler(async ({ data: timeZone, context }) => {
    const { refreshAthleteStateSnapshot } = await import("./athlete-state-snapshot.server");
    return refreshAthleteStateSnapshot(context.supabase, context.userId, timeZone);
  });
