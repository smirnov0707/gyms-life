import { z } from "zod";

/**
 * User-visible provenance state for an athlete-memory entry. These labels
 * describe how a claim is supported; they are deliberately not probabilities.
 */
export const MemoryEvidenceStateSchema = z.enum([
  "user_confirmed",
  "measured_record",
  "calculated_threshold_met",
  "hypothesis_needs_confirmation",
  "experiment_in_progress",
  "system_record",
  "requires_review",
]);

export type MemoryEvidenceState = z.infer<typeof MemoryEvidenceStateSchema>;
