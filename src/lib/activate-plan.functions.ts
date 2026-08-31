import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Makes one generated plan the user's active program.
 * Kept separate from generation so preview/review can become a real
 * confirmation step without duplicating plan persistence logic.
 */
export const activatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: lookupError } = await supabase
      .from("plans")
      .select("id")
      .eq("id", data.planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (!plan) throw new Error("Plan not found");

    const { error: deactivateError } = await supabase
      .from("plans")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (deactivateError) throw new Error(deactivateError.message);

    const { error: activateError } = await supabase
      .from("plans")
      .update({ is_active: true })
      .eq("id", data.planId)
      .eq("user_id", userId);

    if (activateError) throw new Error(activateError.message);

    return { planId: data.planId, activated: true };
  });
