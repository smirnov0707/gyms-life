import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identity is request-scoped; the browser sends nothing and chooses nothing. */
export const getOvernightWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOvernightWork } = await import("./night-lab.read.server");
    return loadOvernightWork(context.supabase, context.userId);
  });
