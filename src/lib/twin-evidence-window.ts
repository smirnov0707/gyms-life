import { z } from "zod";
import {
  buildPersonalTimelinePage,
  type PersonalTimelineEntry,
  type PersonalTimelinePage,
} from "./personal-timeline.read";

export const TwinEvidenceWindowInputSchema = z
  .object({
    olderAt: z.string().datetime({ offset: true }),
    newerAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.olderAt) >= Date.parse(value.newerAt)) {
      context.addIssue({
        code: "custom",
        message: "The older Twin state must precede the newer Twin state.",
        path: ["newerAt"],
      });
    }
  });

export type TwinEvidenceWindowInput = z.infer<typeof TwinEvidenceWindowInputSchema>;

export type TwinEvidenceWindow = {
  olderAt: string;
  newerAt: string;
  events: PersonalTimelineEntry[];
  omittedCount: number;
  hasMore: boolean;
  limit: number;
};

/**
 * Canonicalizes offsets before they reach PostgREST. The interval is
 * (olderAt, newerAt]: an event indexed exactly at the older snapshot boundary
 * is not presented as new evidence for the later state.
 */
export function normalizeTwinEvidenceWindowInput(value: unknown): TwinEvidenceWindowInput {
  const parsed = TwinEvidenceWindowInputSchema.parse(value);
  return {
    olderAt: new Date(parsed.olderAt).toISOString(),
    newerAt: new Date(parsed.newerAt).toISOString(),
  };
}

/**
 * Reuses the same narrow Timeline projection as event history. Defensive
 * interval filtering keeps an unexpected transport row from being presented
 * as evidence for a state transition.
 */
export function buildTwinEvidenceWindow(
  input: unknown,
  value: unknown,
): TwinEvidenceWindow {
  const interval = normalizeTwinEvidenceWindowInput(input);
  const page: PersonalTimelinePage = buildPersonalTimelinePage(value);
  const olderMs = Date.parse(interval.olderAt);
  const newerMs = Date.parse(interval.newerAt);
  let omittedCount = page.omittedCount;
  const events = page.events.filter((event) => {
    const occurredMs = Date.parse(event.occurredAt);
    const belongs = occurredMs > olderMs && occurredMs <= newerMs;
    if (!belongs) omittedCount += 1;
    return belongs;
  });

  return {
    ...interval,
    events,
    omittedCount,
    hasMore: page.hasMore,
    limit: page.limit,
  };
}
