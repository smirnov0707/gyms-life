import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";
import type { BodyMetricRow } from "./body-trend.engine";

/** The signed-in athlete's own measurements, over the composition window. */
export const getBodyComposition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input))
  .handler(async ({ data: requestedTimeZone, context }) => {
    const { buildBodyComposition, COMPOSITION_WINDOW_DAYS } = await import("./body-trend.engine");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const { dayInTimeZone } = await import("./local-day");

    const timeZone =
      requestedTimeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    const today = dayInTimeZone(new Date(), timeZone);
    const from = new Date(Date.parse(`${today}T00:00:00Z`) - COMPOSITION_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await context.supabase
      .from("body_metrics")
      .select("measured_on, weight_kg, body_fat")
      .eq("user_id", context.userId)
      .gte("measured_on", from)
      .order("measured_on", { ascending: false })
      .limit(90);

    // Passed through as null, not as an empty list: "you have never been
    // measured" and "we could not look" are different things to tell somebody
    // about their own body.
    return buildBodyComposition({
      rows: error ? null : ((data ?? []) as BodyMetricRow[]),
      today,
    });
  });
