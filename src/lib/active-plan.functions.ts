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
