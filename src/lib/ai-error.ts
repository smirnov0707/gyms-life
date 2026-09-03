import type { TKey } from "@/lib/i18n";

/**
 * The server maps AI gateway refusals (402 / 429) to stable tokens.
 * Turn those tokens into friendly, localized copy for the UI.
 */
export function aiErrorMessage(error: unknown, t: (key: TKey) => string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("AI_DISABLED")) return t("ai.err.disabled");
  if (raw.includes("AI_CREDITS")) return t("ai.err.credits");
  if (raw.includes("AI_RATE_LIMIT")) return t("ai.err.rate");
  if (
    raw.includes("AI_QUOTA_UNAVAILABLE") ||
    raw.includes("AI_MODEL_UNAVAILABLE") ||
    raw.includes("AI_PROVIDER_UNAVAILABLE") ||
    raw.includes("specificationVersion")
  ) {
    return t("ai.err.unavailable");
  }
  return t("ai.err.unavailable");
}
