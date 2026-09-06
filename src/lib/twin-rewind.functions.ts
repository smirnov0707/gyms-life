import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Browser input cannot choose which athlete's snapshot history is read. */
export const getTwinRewindHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadTwinRewindHistory } = await import("./twin-rewind.server");
    return loadTwinRewindHistory(context.supabase, context.userId);
  });
