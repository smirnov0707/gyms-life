import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActivePlanData } from "./active-plan.service";

export {
  normalizeActivePlan,
  type ActivePlanRow,
  type ActivePlanState,
  type ActiveTrainingPlan,
} from "./active-plan.service";

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getActivePlanData(context.supabase, context.userId));

export const deactivateActivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("plans")
      .update({ is_active: false })
      .eq("user_id", context.userId)
      .eq("is_active", true);
    if (error) throw new Error("ACTIVE_PLAN_DEACTIVATE_FAILED");
    return { ok: true as const };
  });
