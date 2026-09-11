import { describe, expect, it } from "vitest";
import {
  PERSONALIZED_TWIN_DATA_POLICY,
  providerMeetsPersonalizedTwinPolicy,
} from "./personalized-twin.data-policy";

describe("Personalized Twin data policy", () => {
  it("never permits provider training use and deletes raw inputs after processing", () => {
    expect(PERSONALIZED_TWIN_DATA_POLICY).toMatchObject({
      inputPhotoRetention: "delete_after_processing",
      providerTrainingUseAllowed: false,
      externalProcessingConsentRequired: true,
      userDeletionRequired: true,
      medicalScan: false,
    });
  });

  it("keeps a provider blocked until every privacy requirement is evidenced", () => {
    expect(
      providerMeetsPersonalizedTwinPolicy({
        noTrainingOnUserMedia: true,
        deletesInputAfterProcessing: true,
        supportsUserDeletion: true,
        contractReviewed: false,
      }),
    ).toBe(false);
    expect(
      providerMeetsPersonalizedTwinPolicy({
        noTrainingOnUserMedia: true,
        deletesInputAfterProcessing: true,
        supportsUserDeletion: true,
        contractReviewed: true,
      }),
    ).toBe(true);
  });
});
