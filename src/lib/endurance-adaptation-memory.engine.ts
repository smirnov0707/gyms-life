export type AdaptationOutcomeAssociation =
  "improved_signals" | "mixed_signals" | "worse_signals" | "insufficient_signal" | null;

export type AdaptationHistoryItem = {
  reason: string;
  association: AdaptationOutcomeAssociation;
};
export type AdaptationLesson = {
  status: "insufficient_evidence" | "candidate" | "caution";
  reason: string | null;
  supportingOutcomes: number;
  contradictingOutcomes: number;
  evidenceStrength: "low" | "moderate" | "high";
  statement: string | null;
  provenance: "calculated";
};
function evidenceStrength(supporting: number, contradicting: number): "low" | "moderate" | "high" {
  const total = supporting + contradicting;
  if (supporting >= 6 && total > 0 && contradicting / total <= 0.2) return "high";
  if (supporting >= 4 && total > 0 && contradicting / total <= 0.34) return "moderate";
  return "low";
}

export function deriveAdaptationLesson(items: readonly AdaptationHistoryItem[]): AdaptationLesson {
  const reasons = [...new Set(items.map((x) => x.reason))];
  let best: { reason: string; good: number; bad: number } | null = null;
  let caution: { reason: string; good: number; bad: number } | null = null;
  for (const reason of reasons) {
    const x = items.filter((i) => i.reason === reason);
    const good = x.filter((i) => i.association === "improved_signals").length;
    const bad = x.filter((i) => i.association === "worse_signals").length;
    if (good >= 3 && good >= bad + 2 && (!best || good > best.good)) {
      best = { reason, good, bad };
    }
    if (bad >= 3 && bad >= good + 2 && (!caution || bad > caution.bad)) {
      caution = { reason, good, bad };
    }
  }
  if (caution && (!best || caution.bad > best.good)) {
    return {
      status: "caution",
      reason: caution.reason,
      supportingOutcomes: caution.bad,
      contradictingOutcomes: caution.good,
      evidenceStrength: evidenceStrength(caution.bad, caution.good),
      statement:
        "Repeated observed outcomes after this adaptation pattern were worse; treat it as a caution signal, not causal proof.",
      provenance: "calculated",
    };
  }
  if (!best)
    return {
      status: "insufficient_evidence",
      reason: null,
      supportingOutcomes: 0,
      contradictingOutcomes: 0,
      evidenceStrength: "low",
      statement: null,
      provenance: "calculated",
    };
  return {
    status: "candidate",
    reason: best.reason,
    supportingOutcomes: best.good,
    contradictingOutcomes: best.bad,
    evidenceStrength: evidenceStrength(best.good, best.bad),
    statement:
      "Repeated observed outcomes suggest this adaptation pattern may fit this athlete; association is not causal proof.",
    provenance: "calculated",
  };
}
