import { z } from "zod";
import type { LabHypothesisTransition } from "./lab.schema";

export const HypothesisStabilitySchema = z.enum(["no_history", "stable", "changed", "reversed"]);

export const HypothesisStabilitySummarySchema = z
  .object({
    hypothesisId: z.string().trim().min(1).max(120),
    transitions: z.number().int().nonnegative(),
    reversals: z.number().int().nonnegative(),
    latestStatus: z.enum(["insufficient_evidence", "monitoring", "supported", "contradicted"]),
    stability: HypothesisStabilitySchema,
  })
  .strict();

export const HypothesisRetrospectiveSummarySchema = z
  .object({
    hypothesisCount: z.number().int().nonnegative(),
    transitionCount: z.number().int().nonnegative(),
    reversalCount: z.number().int().nonnegative(),
    hypotheses: z.array(HypothesisStabilitySummarySchema),
  })
  .strict();

export type HypothesisRetrospectiveSummary = z.infer<typeof HypothesisRetrospectiveSummarySchema>;
function isReversal(previous: string | null, current: string): boolean {
  return (
    (previous === "supported" && current === "contradicted") ||
    (previous === "contradicted" && current === "supported")
  );
}

export function summarizeHypothesisStability(
  history: readonly LabHypothesisTransition[],
): HypothesisRetrospectiveSummary {
  const grouped = new Map<string, LabHypothesisTransition[]>();
  for (const entry of history) {
    const group = grouped.get(entry.hypothesisId) ?? [];
    group.push(entry);
    grouped.set(entry.hypothesisId, group);
  }

  const hypotheses = [...grouped.entries()]
    .map(([hypothesisId, entries]) => {
      const ordered = [...entries].sort(
        (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
      );
      const latest = ordered.at(-1)!;
      const reversals = ordered.filter((entry) =>
        isReversal(entry.previousStatus, entry.status),
      ).length;
      const transitions = ordered.length;
      return HypothesisStabilitySummarySchema.parse({
        hypothesisId,
        transitions,
        reversals,
        latestStatus: latest.status,
        stability: reversals > 0 ? "reversed" : transitions > 1 ? "changed" : "stable",
      });
    })
    .sort((a, b) => a.hypothesisId.localeCompare(b.hypothesisId));

  return HypothesisRetrospectiveSummarySchema.parse({
    hypothesisCount: hypotheses.length,
    transitionCount: hypotheses.reduce((sum, item) => sum + item.transitions, 0),
    reversalCount: hypotheses.reduce((sum, item) => sum + item.reversals, 0),
    hypotheses,
  });
}
