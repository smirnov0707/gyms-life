/**
 * Body composition from the two numbers the athlete actually records.
 *
 * Weight is measured. Body fat percentage is whatever their scale or caliper
 * said. Fat mass and lean mass are neither: they are those two multiplied
 * together, and every caller has to say so — the arithmetic is exact, the
 * inputs are not, and a lean-mass figure presented as a measurement is the
 * kind of number people change their training over.
 *
 * Pure and total.
 */

export type BodyCompositionReading = {
  day: string;
  weightKg: number;
  bodyFatPercent: number;
  /** weight × body fat %. Derived. */
  fatMassKg: number;
  /** weight − fat mass. Derived from a derived number. */
  leanMassKg: number;
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
};

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
  return {
    day: row.measured_on,
    weightKg: round(weightKg),
    bodyFatPercent: round(bodyFatPercent),
    fatMassKg: round(fatMassKg),
    leanMassKg: round(weightKg - fatMassKg),
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
