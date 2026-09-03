import type { TKey } from "@/lib/i18n";

/** Application-owned AI states that are safe to carry across a server boundary. */
export const SAFE_AI_ERROR_CODES = [
  "AI_DISABLED",
  "AI_CREDITS",
  "AI_DAILY_LIMIT",
  "AI_RATE_LIMIT",
  "AI_QUOTA_UNAVAILABLE",
  "AI_MODEL_UNAVAILABLE",
  "AI_PROVIDER_UNAVAILABLE",
] as const;

export type SafeAiErrorCode = (typeof SAFE_AI_ERROR_CODES)[number];

/**
 * Provider errors can contain implementation or account details. Preserve only
 * the small, application-owned contract the member is allowed to see.
 */
export function getSafeAiErrorCode(error: unknown): SafeAiErrorCode | null {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return SAFE_AI_ERROR_CODES.find((code) => raw.includes(code)) ?? null;
}

/** Rethrow a stable product error while leaving unknown provider errors private. */
export function rethrowSafeAiError(error: unknown): void {
  const code = getSafeAiErrorCode(error);
  if (code) throw new Error(code);
}

/**
 * The server maps AI gateway refusals (402 / 429) to stable tokens.
 * Turn those tokens into friendly, localized copy for the UI.
 */
export function aiErrorMessage(error: unknown, t: (key: TKey) => string): string {
  switch (getSafeAiErrorCode(error)) {
    case "AI_DISABLED":
      return t("ai.err.disabled");
    case "AI_CREDITS":
      return t("ai.err.credits");
    case "AI_DAILY_LIMIT":
      return t("ai.err.dailyLimit");
    case "AI_RATE_LIMIT":
      return t("ai.err.rate");
    default:
      return t("ai.err.unavailable");
  }
}
