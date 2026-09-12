import { describe, expect, it } from "vitest";
import {
  assertPersonalizedTwinProviderActivation,
  evaluatePersonalizedTwinProviderActivation,
} from "./personalized-twin.provider-activation";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

const approvedCapability: PersonalizedTwinProviderCapability = {
  available: true,
  providerKey: "reviewed-provider",
  candidate: "in3d",
  captureModes: ["guided_video"],
  outputFormat: "glb",
  externalProcessing: true,
  privacyReview: "approved",
  medicalScan: false,
};

const approvedReview = {
  dpaApproved: true,
  retentionApproved: true,
  trainingUseProhibited: true,
  userDeletionSupported: true,
  transferRiskApproved: true,
  captureConsentVersion: "personalized_twin_v1" as const,
};

describe("Personalized Twin provider activation", () => {
  it("fails closed when any governance gate is missing", () => {
    const decision = evaluatePersonalizedTwinProviderActivation({
      capability: { ...approvedCapability, privacyReview: "requires_contract" },
      review: { ...approvedReview, retentionApproved: false },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain("privacy_review_not_approved");
    expect(decision.blockers).toContain("retention_not_approved");
  });

  it("allows activation only when capability and governance are fully approved", () => {
    expect(
      evaluatePersonalizedTwinProviderActivation({
        capability: approvedCapability,
        review: approvedReview,
      }),
    ).toEqual({ allowed: true, blockers: [] });
    expect(() =>
      assertPersonalizedTwinProviderActivation({
        capability: approvedCapability,
        review: approvedReview,
      }),
    ).not.toThrow();
  });
});
