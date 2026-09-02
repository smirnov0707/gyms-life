import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the user's transparent, validated Digital Athlete model. */
export const getAthleteModel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { refreshAthleteStateSnapshot } = await import("./athlete-state-snapshot.server");
    return refreshAthleteStateSnapshot(context.supabase, context.userId);
  });
