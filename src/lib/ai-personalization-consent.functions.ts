import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AI_PERSONALIZATION_POLICY_VERSION = "2026-09-02";

const ConsentInput = z.object({
  granted: z.boolean(),
});

/** Returns the user's latest immutable consent decision. */
export const getAiPersonalizationConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_personalization_consents")
      .select("granted, policy_version, recorded_at")
      .eq("user_id", context.userId)
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Could not load AI personalization consent.");

    return {
      granted: data?.granted ?? false,
      policyVersion: data?.policy_version ?? null,
      recordedAt: data?.recorded_at ?? null,
    };
  });

/** Appends a decision; users cannot rewrite or delete their consent history. */
export const recordAiPersonalizationConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ConsentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: recorded, error } = await context.supabase
      .from("ai_personalization_consents")
      .insert({
        user_id: context.userId,
        granted: data.granted,
        policy_version: AI_PERSONALIZATION_POLICY_VERSION,
      })
      .select("granted, policy_version, recorded_at")
      .single();

    if (error || !recorded) throw new Error("Could not save AI personalization consent.");

    return {
      granted: recorded.granted,
      policyVersion: recorded.policy_version,
      recordedAt: recorded.recorded_at,
    };
  });
