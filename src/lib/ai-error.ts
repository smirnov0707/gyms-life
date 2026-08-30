import type { TKey } from "@/lib/i18n";

/**
 * The server maps AI gateway refusals (402 / 429) to stable tokens.
 * Turn those tokens into friendly, localized copy for the UI.
 */
export function aiErrorMessage(error: unknown, t: (key: TKey) => string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("AI_DISABLED")) return t("ai.err.disabled" as TKey);
  if (raw.includes("AI_CREDITS")) return t("ai.err.credits" as TKey);
  if (raw.includes("AI_RATE_LIMIT")) return t("ai.err.rate" as TKey);
  return raw || t("common.error" as TKey);
}
