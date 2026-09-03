import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";

/**
 * Saves the browser's validated IANA zone on the authenticated user's profile.
 * The server owns the user ID, so a client cannot choose another profile.
 */
export const syncProfileTimeZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.parse(input))
  .handler(async ({ data: timeZone, context }) => {
    const { data: existing, error: readError } = await context.supabase
      .from("profiles")
      .select("time_zone")
      .eq("id", context.userId)
      .maybeSingle();

    if (readError || !existing) throw new Error("Could not load profile time zone.");

    const currentTimeZone = IanaTimeZoneSchema.safeParse(existing.time_zone);
    if (currentTimeZone.success && currentTimeZone.data === timeZone) {
      return { timeZone: currentTimeZone.data };
    }

    const { data: updated, error: updateError } = await context.supabase
      .from("profiles")
      .update({ time_zone: timeZone })
      .eq("id", context.userId)
      .select("time_zone")
      .maybeSingle();

    if (updateError || !updated) throw new Error("Could not save profile time zone.");

    return { timeZone: IanaTimeZoneSchema.parse(updated.time_zone) };
  });
