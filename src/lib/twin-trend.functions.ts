import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ownership comes only from authenticated middleware, never browser input. */
export const getTwinTrendHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadTwinTrendHistory } = await import("./twin-trend.server");
    return loadTwinTrendHistory(context.supabase, context.userId);
  });
