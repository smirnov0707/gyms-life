/**
 * The one sentence this screen may never be shown without.
 *
 * The micronutrient scanner names deficiencies, prints a current and a target
 * intake, and recommends a supplement with a dose. That is close enough to
 * clinical advice that the product says, in the same breath, that it is not:
 * "This is not a medical diagnosis. See a doctor for blood work."
 *
 * That sentence was hardcoded into the deterministic fallback and left to the
 * model on the path an athlete actually sees. The component renders the
 * warnings block only when the list is non-empty, so a model that returned no
 * warnings — or four warnings about something else — produced a screen
 * prescribing vitamin D with nothing on it saying this is not a diagnosis.
 * PART XXXIII puts unsupported medical claims among the hard rules AI may not
 * bypass, and a rule the model is trusted to remember is not a hard rule.
 *
 * So the disclaimer is prepended here, to every result, from both paths. It is
 * first, so a length cap can never be what removes it.
 *
 * Pure and total.
 */

export const MEDICAL_DISCLAIMER: Readonly<Record<"lt" | "en", string>> = {
  lt: "Tai nėra medicininė diagnozė. Dėl kraujo tyrimų kreipkis į gydytoją.",
  en: "This is not a medical diagnosis. See a doctor for blood work.",
};

/** How many warnings the screen shows in total, the disclaimer included. */
export const MAX_SCAN_WARNINGS = 5;

const disclaimerFor = (lang: string): string =>
  lang.toLowerCase().startsWith("lt") ? MEDICAL_DISCLAIMER.lt : MEDICAL_DISCLAIMER.en;

const normalise = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The warnings a scan result may carry, with the disclaimer guaranteed.
 *
 * A model that produced the sentence itself does not get it twice; a model
 * that paraphrased it does, and that is the right direction to fail in —
 * saying it twice is untidy, and not saying it at all is the thing this
 * function exists to prevent.
 */
export function withMedicalDisclaimer(
  warnings: readonly string[],
  lang: string,
  limit = MAX_SCAN_WARNINGS,
): string[] {
  const disclaimer = disclaimerFor(lang);
  const seen = new Set<string>([normalise(disclaimer)]);
  const rest: string[] = [];

  for (const warning of warnings) {
    const text = warning.trim();
    if (!text) continue;
    const key = normalise(text);
    if (seen.has(key)) continue;
    seen.add(key);
    rest.push(text);
  }

  // The disclaimer leads, so the cap trims the model's warnings rather than
  // the one sentence that has to be there.
  const room = Math.max(1, Math.floor(limit)) - 1;
  return [disclaimer, ...rest.slice(0, room)];
}
