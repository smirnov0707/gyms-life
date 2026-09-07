/**
 * Body composition from the two numbers the athlete's record actually holds.
 *
 * Three tiers of certainty, and the card has to keep them apart. Weight and
 * body fat percentage may be measured — a scale, a caliper, typed in — or they
 * may have come from the photo scan, where body fat is a blend that includes a
 * vision model's visual estimate and weight is the model's own guess unless
 * the athlete supplied one. Fat mass and lean mass are neither: they are those
 * two multiplied together, exact arithmetic on inexact inputs.
 *
 * `estimated` carries the first distinction up to the card. It used to say
 * flatly that weight and body fat were measured, which for a scanned row was
 * simply false.
 *
 * Pure and total.
 */

/** Absent for rows written before provenance was recorded. */
export type BodyMetricSource = "measured" | "photo_estimate" | null;

export type BodyCompositionReading = {
  day: string;
  weightKg: number;
  bodyFatPercent: number;
  /** weight × body fat %. Derived. */
  fatMassKg: number;
  /** weight − fat mass. Derived from a derived number. */
  leanMassKg: number;
  /** True when either input came from the photo scan rather than a scale. */
  estimated: boolean;
  /** True when the record does not say where either input came from. */
  provenanceUnknown: boolean;
};

export type BodyCompositionChange =
  /** The source could not be read. Not the same as having no measurements. */
  | { status: "unreadable" }
  /** Nothing in the window carried both numbers on the same day. */
  | { status: "none" }
  /** One reading: the composition is known, the direction of travel is not. */
  | { status: "single"; latest: BodyCompositionReading }
  | {
      status: "change";
      latest: BodyCompositionReading;
      earliest: BodyCompositionReading;
      days: number;
      weightKg: number;
      fatMassKg: number;
      leanMassKg: number;
    };

export type BodyMetricRow = {
  measured_on: string;
  weight_kg: number | string | null;
  body_fat: number | string | null;
  weight_source?: string | null;
  body_fat_source?: string | null;
};

const source = (value: unknown): BodyMetricSource =>
  value === "measured" || value === "photo_estimate" ? value : null;

/** How far back a comparison may reach. The template's window is 30 days. */
export const COMPOSITION_WINDOW_DAYS = 30;

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A row becomes a reading only when both numbers came off the same row.
 *
 * A weight from this morning and a body fat percentage from three weeks ago
 * describe two different bodies; multiplying them produces a fat mass that was
 * never true on any day.
 */
export function toReading(row: BodyMetricRow): BodyCompositionReading | null {
  const weightKg = numeric(row.weight_kg);
  const bodyFatPercent = numeric(row.body_fat);
  if (weightKg === null || bodyFatPercent === null) return null;
  if (weightKg <= 0 || bodyFatPercent < 0 || bodyFatPercent >= 100) return null;
  const fatMassKg = (weightKg * bodyFatPercent) / 100;
  const weightFrom = source(row.weight_source);
  const bodyFatFrom = source(row.body_fat_source);
  return {
    day: row.measured_on,
    weightKg: round(weightKg),
    bodyFatPercent: round(bodyFatPercent),
    fatMassKg: round(fatMassKg),
    leanMassKg: round(weightKg - fatMassKg),
    // One estimated input is enough: fat mass and lean mass are the product of
    // both, so an estimate anywhere makes the whole reading an estimate.
    estimated: weightFrom === "photo_estimate" || bodyFatFrom === "photo_estimate",
    provenanceUnknown: weightFrom === null || bodyFatFrom === null,
  };
}

function daysBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function buildBodyComposition(input: {
  /** Null when the query failed rather than returned nothing. */
  rows: readonly BodyMetricRow[] | null;
  today: string;
  windowDays?: number;
}): BodyCompositionChange {
  if (input.rows === null) return { status: "unreadable" };

  const window = input.windowDays ?? COMPOSITION_WINDOW_DAYS;
  const readings = input.rows
    .map(toReading)
    .filter((reading): reading is BodyCompositionReading => reading !== null)
    .filter((reading) => {
      const age = daysBetween(reading.day, input.today);
      return age !== null && age >= 0 && age <= window;
    })
    .sort((left, right) => left.day.localeCompare(right.day));

  const earliest = readings[0];
  const latest = readings[readings.length - 1];
  if (!earliest || !latest) return { status: "none" };
  // One reading, or several taken on one day: a composition, but no change.
  if (earliest.day === latest.day) return { status: "single", latest };

  return {
    status: "change",
    latest,
    earliest,
    days: daysBetween(earliest.day, latest.day) ?? 0,
    weightKg: round(latest.weightKg - earliest.weightKg),
    fatMassKg: round(latest.fatMassKg - earliest.fatMassKg),
    leanMassKg: round(latest.leanMassKg - earliest.leanMassKg),
  };
}
