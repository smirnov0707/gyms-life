import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getEnduranceTwinProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadEnduranceTwinProfile } = await import("./endurance-twin.service");
    return loadEnduranceTwinProfile(context.supabase, context.userId);
  });
