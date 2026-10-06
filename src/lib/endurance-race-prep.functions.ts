import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { IanaTimeZoneSchema } from "./local-day";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getActiveRacePrep = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ today: z.string().date(), timeZone: IanaTimeZoneSchema }).parse(value))
  .handler(async ({ data, context }) => {
    const { loadActiveRacePrep } = await import("./endurance-race-prep.service");
    return loadActiveRacePrep(context.supabase, context.userId, data.today, data.timeZone);
  });
