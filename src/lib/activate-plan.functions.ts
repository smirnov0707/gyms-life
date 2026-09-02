import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";

export const activatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return observeServerAction(
      {
        eventName: "training_plan.activation",
        userId: context.userId,
        failureCode: "TRAINING_PLAN_ACTIVATION_FAILED",
        metadata: {},
      },
      async () => {
        const { data: activatedPlanId, error } = await context.supabase.rpc(
          "activate_training_plan",
          {
            p_plan_id: data.planId,
          },
        );

        if (error || !activatedPlanId) {
          throw new Error(`Could not activate training plan: ${error?.message ?? "unknown error"}`);
        }

        return { ok: true, planId: activatedPlanId };
      },
    );
  });
