import { activateValidatedTrainingPlan } from "./training-activation.service";
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
        const activatedPlanId = await activateValidatedTrainingPlan(
          context.supabase,
          context.userId,
          data.planId,
        );

        return { ok: true, planId: activatedPlanId };
      },
    );
  });
