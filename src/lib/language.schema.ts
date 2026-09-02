import { z } from "zod";

/**
 * The languages GYMS.LIFE can render and request from AI providers.
 *
 * Keep this at the transport/domain boundary rather than repeating loose
 * strings in every server function. A provider should never have to infer a
 * locale from unvalidated client input.
 */
export const SupportedLanguageSchema = z.enum(["lt", "en", "ru", "uk", "pl", "de", "es", "fr"]);

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const LANGUAGE_NAMES = {
  lt: "Lithuanian",
  en: "English",
  ru: "Russian",
  uk: "Ukrainian",
  pl: "Polish",
  de: "German",
  es: "Spanish",
  fr: "French",
} satisfies Record<SupportedLanguage, string>;

export function parseSupportedLanguage(value: unknown): SupportedLanguage | null {
  const parsed = SupportedLanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
