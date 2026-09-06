import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TwinEvidenceWindowInputSchema } from "./twin-evidence-window";

/** Identity is request-scoped; only the two snapshot boundaries cross the browser boundary. */
export const getTwinEvidenceWindow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => TwinEvidenceWindowInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { loadTwinEvidenceWindow } = await import("./twin-evidence-window.server");
    return loadTwinEvidenceWindow(context.supabase, context.userId, data);
  });
