import { z } from "zod";

export const PersonalizedTwinProviderReviewCandidateSchema = z.object({
  key: z.enum(["3dlook", "avatar_sdk", "in3d", "meshy"]),
  rank: z.number().int().positive(),
  captureFit: z.enum(["strong", "partial", "unknown"]),
  privacyEvidence: z.enum(["documented", "partial", "insufficient"]),
  retentionEvidence: z.enum(["documented", "partial", "insufficient"]),
  apiEvidence: z.enum(["documented", "partial", "insufficient"]),
  outputEvidence: z.enum(["documented", "partial", "insufficient"]),
  status: z.literal("review_only"),
});

export type PersonalizedTwinProviderReviewCandidate = z.infer<
  typeof PersonalizedTwinProviderReviewCandidateSchema
>;

export const PERSONALIZED_TWIN_PROVIDER_REVIEW: readonly PersonalizedTwinProviderReviewCandidate[] =
  [
    {
      key: "3dlook",
      rank: 1,
      captureFit: "strong",
      privacyEvidence: "documented",
      retentionEvidence: "documented",
      apiEvidence: "documented",
      outputEvidence: "documented",
      status: "review_only",
    },
    {
      key: "avatar_sdk",
      rank: 2,
      captureFit: "partial",
      privacyEvidence: "partial",
      retentionEvidence: "insufficient",
      apiEvidence: "documented",
      outputEvidence: "documented",
      status: "review_only",
    },
    {
      key: "in3d",
      rank: 3,
      captureFit: "unknown",
      privacyEvidence: "insufficient",
      retentionEvidence: "insufficient",
      apiEvidence: "partial",
      outputEvidence: "partial",
      status: "review_only",
    },
    {
      key: "meshy",
      rank: 4,
      captureFit: "partial",
      privacyEvidence: "insufficient",
      retentionEvidence: "insufficient",
      apiEvidence: "documented",
      outputEvidence: "documented",
      status: "review_only",
    },
  ] as const;

export function leadingPersonalizedTwinProviderCandidate(): PersonalizedTwinProviderReviewCandidate {
  const candidate = PERSONALIZED_TWIN_PROVIDER_REVIEW.find((item) => item.rank === 1);
  if (!candidate) throw new Error("PERSONALIZED_TWIN_PROVIDER_REVIEW_MISSING_LEADER");
  return candidate;
}
