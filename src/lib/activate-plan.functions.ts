import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: activatedPlanId, error } = await context.supabase.rpc("activate_training_plan", {
      p_plan_id: data.planId,
    });

    if (error || !activatedPlanId) {
      throw new Error(`Could not activate training plan: ${error?.message ?? "unknown error"}`);
    }

    return { ok: true, planId: activatedPlanId };
  });
