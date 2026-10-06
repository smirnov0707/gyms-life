import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ConfirmRaceSessionMatchSchema } from "./endurance-session-match.service";

export const confirmRaceSessionMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => ConfirmRaceSessionMatchSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { confirmRaceSessionMatch } = await import("./endurance-session-match.service");
    return confirmRaceSessionMatch(context.supabase, context.userId, data);
  });
