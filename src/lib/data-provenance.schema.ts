import { z } from "zod";

/**
 * Canonical provenance vocabulary for all important GYMS.LIFE observations,
 * derived state, predictions and simulations.
 *
 * Values are intentionally stable storage/API identifiers. UI copy may render
 * them in uppercase (MEASURED, INFERRED, ...), but domain logic must use this
 * contract instead of inventing local source enums.
 */
export const DataProvenanceSchema = z.enum([
  "known",
  "measured",
  "user_reported",
  "device_reported",
  "calculated",
  "inferred",
  "predicted",
  "simulated",
  "unknown",
]);

export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

export const DATA_PROVENANCE = DataProvenanceSchema.options;

export function isObservedProvenance(value: DataProvenance): boolean {
  return value === "known" || value === "measured" || value === "user_reported" || value === "device_reported";
}

export function isDerivedProvenance(value: DataProvenance): boolean {
  return value === "calculated" || value === "inferred" || value === "predicted" || value === "simulated";
}
