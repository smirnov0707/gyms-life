const DEFAULT_DAILY_AI_REQUEST_LIMIT = 50;
const MAX_DAILY_AI_REQUEST_LIMIT = 500;

type AiQuotaRpcResult = {
  data: boolean | null;
  error: { code: string } | null;
};

type AiQuotaRpc = (args: { p_user_id: string; p_limit: number }) => PromiseLike<AiQuotaRpcResult>;

function readDailyAiRequestLimit(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_DAILY_AI_REQUEST_LIMIT
    ? parsed
    : DEFAULT_DAILY_AI_REQUEST_LIMIT;
}

const DAILY_AI_REQUEST_LIMIT = readDailyAiRequestLimit(process.env["AI_DAILY_REQUEST_LIMIT"]);

export class AiQuotaExceededError extends Error {
  constructor() {
    super("AI_DAILY_LIMIT");
    this.name = "AiQuotaExceededError";
  }
}

/**
 * Reserves one model request for an authenticated user before the provider is
 * called. The database RPC is service-role only, so callers cannot choose a
 * different user or a larger quota through the public Data API.
 */
export async function reserveAiRequest(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await reserveAiRequestWithRpc(userId, (args) => supabaseAdmin.rpc("consume_ai_quota", args));
}

export async function reserveAiRequestWithRpc(userId: string, rpc: AiQuotaRpc): Promise<void> {
  const { data: allowed, error } = await rpc({
    p_user_id: userId,
    p_limit: DAILY_AI_REQUEST_LIMIT,
  });

  if (error) {
    console.error("[AI] Could not reserve request quota", { code: error.code });
    throw new Error("AI_QUOTA_UNAVAILABLE");
  }

  if (!allowed) {
    throw new AiQuotaExceededError();
  }
}

export { DAILY_AI_REQUEST_LIMIT };
