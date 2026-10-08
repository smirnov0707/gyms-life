import { z } from "zod";

/** A retry identifies an existing record; it never accepts replacement workout evidence. */
export const RetryEnduranceRaceEnrichmentSchema = z
  .object({ workoutSessionId: z.string().uuid() })
  .strict();

export type EnduranceEnrichmentStage = "load" | "classify" | "link" | "refresh";

export type EnduranceRaceEnrichmentState =
  | {
      status: "not_applicable" | "no_active_plan" | "no_match" | "needs_confirmation" | "matched";
      linked: boolean;
      retryable: false;
    }
  | {
      status: "unavailable";
      linked: boolean;
      retryable: true;
      stage: EnduranceEnrichmentStage;
    };
