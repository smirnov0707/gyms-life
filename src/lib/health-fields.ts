/**
 * The fields a phone automation may send to the health endpoint.
 *
 * This exists because the setup screen used to carry a hand-written example
 * payload, and the endpoint grew fields the example never mentioned. Nobody
 * noticed, because an athlete cannot tell a field that was rejected from one
 * that was never sent — both show up as an empty panel. So the example is
 * generated from this list, and a test sends every name on it through the
 * normalizer to prove the documentation is true rather than merely old.
 *
 * Only canonical names are listed. The normalizer accepts many spellings of
 * each — `rhr`, `Resting HR`, `heart_rate` all reach resting heart rate — but
 * a reference that listed every alias would be a wall of text nobody reads,
 * and these are the names worth pasting into a shortcut.
 */

export type HealthField = {
  /** The name to send. */
  key: string;
  /** A plausible value, used in the example payload. */
  example: number;
  /** The unit the value is read in, for the reference line. */
  unit: "h" | "min" | "ms" | "bpm" | "kcal" | "steps" | "ml/kg/min" | "1-5";
  /**
   * True for the fields that describe how the night was spent rather than how
   * long it lasted. Grouped separately because a source that reports them at
   * all reports all of them, and one on its own is worth less.
   */
  stage?: boolean;
};

export const HEALTH_INGEST_FIELDS: readonly HealthField[] = [
  { key: "sleep_hours", example: 7.4, unit: "h" },
  { key: "sleep_deep_minutes", example: 82, unit: "min", stage: true },
  { key: "sleep_rem_minutes", example: 96, unit: "min", stage: true },
  { key: "sleep_core_minutes", example: 256, unit: "min", stage: true },
  { key: "sleep_awake_minutes", example: 24, unit: "min", stage: true },
  { key: "sleep_quality", example: 4, unit: "1-5" },
  { key: "hrv_ms", example: 68, unit: "ms" },
  { key: "resting_hr", example: 52, unit: "bpm" },
  { key: "steps", example: 8342, unit: "steps" },
  { key: "active_kcal", example: 563, unit: "kcal" },
  { key: "vo2max", example: 47, unit: "ml/kg/min" },
];

/**
 * The example payload shown on the setup screen, built from the list above so
 * it cannot drift away from what the endpoint accepts.
 *
 * `token` leads because it is the one required field, and `date` is included
 * because an automation that runs in the morning is usually reporting the
 * night before — a sample with no date is filed under the athlete's today.
 */
export function healthPayloadExample(): string {
  const lines = [
    '  "token": "…",',
    '  "date": "2026-09-06",',
    ...HEALTH_INGEST_FIELDS.map(
      (field, index) =>
        `  "${field.key}": ${field.example}${index === HEALTH_INGEST_FIELDS.length - 1 ? "" : ","}`,
    ),
  ];
  return `{\n${lines.join("\n")}\n}`;
}
