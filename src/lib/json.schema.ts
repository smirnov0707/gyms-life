import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

/**
 * The generated Supabase type correctly treats JSON columns as untrusted.
 * Keep conversion to that transport shape explicit at the database boundary.
 */
export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);

export function serializeJson(value: unknown): Json {
  return JsonSchema.parse(value);
}
