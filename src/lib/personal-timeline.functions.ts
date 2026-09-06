import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ownership comes only from the authenticated request, never browser input. */
export const getPersonalTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadPersonalTimeline } = await import("./personal-timeline.read.server");
    return loadPersonalTimeline(context.supabase, context.userId);
  });
