import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const getLatestPostRunBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadLatestPostRunBrief } = await import("./endurance-post-run.service");
    return loadLatestPostRunBrief(context.supabase, context.userId);
  });
