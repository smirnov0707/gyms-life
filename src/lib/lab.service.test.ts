import { describe, expect, it } from "vitest";
import { composeLabDecisions, parseRows, DecisionEvidenceRowSchema } from "./lab.service";

const decisionId = "00000000-0000-4000-8000-000000000001";
const otherDecisionId = "00000000-0000-4000-8000-000000000002";

describe("composeLabDecisions", () => {
  it("attaches evidence and outcome to the matching decision only", () => {
    const result = composeLabDecisions(
      [
        {
          id: decisionId,
          decision_on: "2026-09-01",
          action: "train_adapted",
          decision_basis: "current_checkin",
          status: "completed",
          created_at: "2026-09-01T08:00:00.000Z",
        },
        {
          id: otherDecisionId,
          decision_on: "2026-08-31",
          action: "recover",
          decision_basis: "safety_rule",
          status: "dismissed",
          created_at: "2026-08-31T08:00:00.000Z",
        },
      ],
      [
        {
          decision_id: decisionId,
          evidence_key: "today_readiness",
          evidence_value: "72",
          source_class: "user_reported",
          position: 0,
        },
      ],
      [{ decision_id: decisionId, outcome: "completed" }],
    );

    expect(result).toEqual([
      {
        id: decisionId,
        decisionOn: "2026-09-01",
        action: "train_adapted",
        basis: "current_checkin",
        status: "completed",
        evidence: [
          { key: "today_readiness", value: "72", sourceClass: "user_reported", position: 0 },
        ],
        outcome: "completed",
        createdAt: "2026-09-01T08:00:00.000Z",
      },
      {
        id: otherDecisionId,
        decisionOn: "2026-08-31",
        action: "recover",
        basis: "safety_rule",
        status: "dismissed",
        evidence: [],
        outcome: null,
        createdAt: "2026-08-31T08:00:00.000Z",
      },
    ]);
  });

  it("returns an empty list for no decisions without throwing", () => {
    expect(composeLabDecisions([], [], [])).toEqual([]);
  });
});

describe("parseRows", () => {
  const evidence = {
    decision_id: "11111111-1111-4111-8111-111111111111",
    evidence_key: "today_readiness",
    evidence_value: "62",
    source_class: "user_reported",
    position: 0,
  };

  it("keeps the rows it can read and says nothing was lost", () => {
    const result = parseRows(DecisionEvidenceRowSchema, [evidence]);
    expect(result.rows).toHaveLength(1);
    expect(result.lost).toBe(false);
  });

  it("costs one bad row one line, not the whole list its evidence", () => {
    const result = parseRows(DecisionEvidenceRowSchema, [
      evidence,
      { ...evidence, position: "third" },
      { ...evidence, position: 1 },
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.lost).toBe(true);
  });

  it("reports a loss when the source did not even answer with a list", () => {
    expect(parseRows(DecisionEvidenceRowSchema, { rows: [] })).toEqual({ rows: [], lost: true });
    // Nothing at all is an absence, not a loss.
    expect(parseRows(DecisionEvidenceRowSchema, null)).toEqual({ rows: [], lost: false });
  });
});
