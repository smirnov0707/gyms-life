/**
 * What a stored reading's `source` entitles the product to say about it.
 *
 * The ingest endpoint accepted `apple_health | google_fit | manual | import`
 * and **defaulted to `apple_health`**. A sender that said nothing about itself
 * was therefore recorded as an Apple Health sync — a named vendor asserted
 * about data nobody named. PART VI asks every important value to know where it
 * came from; "we assumed" is not knowing, and it is stored forever.
 *
 * It did not show yet, because the rail collapsed every non-manual source to
 * "device", and a defaulted vendor still reads as a device. Two things made
 * that worth fixing anyway: `import` also read as "device", and a file an
 * athlete uploaded is not a reading their watch took; and the stored value is
 * what PART XVI's canonical health model will normalise per source, so a
 * guessed vendor is a wrong answer waiting for a feature to ask the question.
 *
 * Pure and total.
 */

/** What the ingest endpoint accepts, plus the honest answer for a silent sender. */
export const HEALTH_SAMPLE_SOURCES = [
  "apple_health",
  "google_fit",
  "manual",
  "import",
  "unknown",
] as const;

export type HealthSampleSource = (typeof HEALTH_SAMPLE_SOURCES)[number];

/**
 * What a sender who did not identify itself is recorded as.
 *
 * Not a vendor. A reading that arrived without saying where it came from is a
 * reading whose origin we do not know, and the store should say that rather
 * than pick the most likely one.
 */
export const DEFAULT_HEALTH_SAMPLE_SOURCE: HealthSampleSource = "unknown";

/**
 * `device`   — a phone or watch health platform reported it.
 * `manual`   — the athlete typed it.
 * `estimate` — a blend including a vision model's visual estimate, not a
 *              measurement anybody took.
 * `imported` — it came from a file or a migration, not from a device.
 * `unknown`  — nothing recorded said, or the value is one this build does not
 *              recognise. Never "device": an unrecognised source is the one
 *              case where guessing is most likely to be wrong.
 */
export type HealthSourceClaim = "device" | "manual" | "estimate" | "imported" | "unknown";

export function sourceClaim(source: string | null | undefined): HealthSourceClaim {
  switch (source) {
    case "apple_health":
    case "google_fit":
    case "watch":
      return "device";
    case "manual":
      return "manual";
    case "photo_estimate":
      return "estimate";
    case "import":
      return "imported";
    default:
      return "unknown";
  }
}
