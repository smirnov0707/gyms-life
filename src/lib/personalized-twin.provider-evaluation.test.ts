import { describe, expect, it } from "vitest";
import {
  leadingPersonalizedTwinProviderCandidate,
  PERSONALIZED_TWIN_PROVIDER_REVIEW,
} from "./personalized-twin.provider-evaluation";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

describe("Personalized Twin provider evaluation", () => {
  it("keeps every evaluated provider review-only", () => {
    expect(
      PERSONALIZED_TWIN_PROVIDER_REVIEW.every((candidate) => candidate.status === "review_only"),
    ).toBe(true);
  });

  it("selects 3DLOOK only as the leading review candidate while activation stays blocked", () => {
    expect(leadingPersonalizedTwinProviderCandidate().key).toBe("3dlook");
    expect(personalizedTwinProviderCapability()).toMatchObject({
      available: false,
      providerKey: null,
      privacyReview: "requires_contract",
    });
  });
});
