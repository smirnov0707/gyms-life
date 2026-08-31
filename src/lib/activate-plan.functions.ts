import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, user_id, is_active")
      .eq("id", data.planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (planError) throw new Error(`Plan lookup failed: ${planError.message}`);
    if (!plan) throw new Error("Plan not found");

    const { error: deactivateError } = await supabase
      .from("plans")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (deactivateError) throw new Error(`Could not deactivate current plan: ${deactivateError.message}`);

    const { error: activateError } = await supabase
      .from("plans")
      .update({ is_active: true })
      .eq("id", plan.id)
      .eq("user_id", userId);

    if (activateError) throw new Error(`Could not activate plan: ${activateError.message}`);

    return { ok: true, planId: plan.id };
  });
