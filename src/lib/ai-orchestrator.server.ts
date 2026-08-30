import { createAiRouterProvider } from "./ai-gateway.server";
import { buildUserContext, contextForAi } from "./user-context.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Single orchestration entry point: GYMS.LIFE owns context; specialist models
 * are replaceable workers. This module is deliberately provider-agnostic.
 */
export async function createOrchestratedAi(
  task: string,
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const context = await buildUserContext(supabase, userId);
  return {
    provider: createAiRouterProvider(task),
    context,
    contextPrompt: `GYMS.LIFE CENTRAL USER CONTEXT (source of truth):\n${contextForAi(context)}`,
  };
}
