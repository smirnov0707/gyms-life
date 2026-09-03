import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";

export const BODY_METRIC_SELECT = "id, measured_on, weight_kg, body_fat, created_at";

export type BodyMetricRow = Pick<
  Tables<"body_metrics">,
  "id" | "measured_on" | "weight_kg" | "body_fat" | "created_at"
>;

export const BodyMetricSchema = z.object({
  id: z.string().uuid(),
  measuredOn: z.string().date(),
  weightKg: z.number().finite().positive().max(500).nullable(),
  bodyFat: z.number().finite().min(0).max(100).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export type BodyMetric = z.infer<typeof BodyMetricSchema>;

const optionalDecimal = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().replace(",", ".");
    return normalized === "" ? undefined : normalized;
  }, z.coerce.number().pipe(schema).optional());

/**
 * A manually logged measurement is untrusted user input until it passes this
 * boundary. Keeping its fields aligned with the Supabase row avoids another
 * hand-written persistence type in the UI.
 */
export const ManualBodyMetricSchema = z
  .object({
    weight_kg: optionalDecimal(z.number().finite().positive().max(500)),
    body_fat: optionalDecimal(z.number().finite().min(0).max(100)),
  })
  .refine(
    (measurement) => measurement.weight_kg !== undefined || measurement.body_fat !== undefined,
    {
      message: "At least one body measurement is required.",
    },
  );

export type ManualBodyMetric = z.infer<typeof ManualBodyMetricSchema>;

export function normalizeManualBodyMetric(value: unknown): ManualBodyMetric {
  const parsed = ManualBodyMetricSchema.parse(value);
  return {
    ...(parsed.weight_kg !== undefined ? { weight_kg: roundToTwoDecimals(parsed.weight_kg) } : {}),
    ...(parsed.body_fat !== undefined ? { body_fat: roundToTwoDecimals(parsed.body_fat) } : {}),
  };
}

export function parseBodyMetric(row: BodyMetricRow): BodyMetric {
  return BodyMetricSchema.parse({
    id: row.id,
    measuredOn: row.measured_on,
    weightKg: row.weight_kg,
    bodyFat: row.body_fat,
    createdAt: row.created_at,
  });
}

/** Invalid historical measurements stay out of charts and athlete-state inputs. */
export function parseBodyMetrics(rows: BodyMetricRow[]): BodyMetric[] {
  return rows.flatMap((row) => {
    const parsed = BodyMetricSchema.safeParse({
      id: row.id,
      measuredOn: row.measured_on,
      weightKg: row.weight_kg,
      bodyFat: row.body_fat,
      createdAt: row.created_at,
    });
    return parsed.success ? [parsed.data] : [];
  });
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}
