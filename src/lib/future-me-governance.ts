import { z } from "zod";
import type { DeterministicLiftForecast } from "./forecast.schema";
import { isValidatedFutureMeHorizon, type FutureMeHorizon } from "./future-me-simulation";

export const FutureMeGovernanceSchema = z
  .object({
    kind: z.literal("simulation"),
    horizon: z.enum(["30d", "90d", "180d", "1y"]),
    outputAvailable: z.boolean(),
    evidenceStrength: z.enum(["low", "moderate", "high"]).nullable(),
    assumptions: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
    decisionAuthority: z.literal(false),
    causalClaimAllowed: z.literal(false),
    guaranteeAllowed: z.literal(false),
  })
  .strict();

export type FutureMeGovernance = z.infer<typeof FutureMeGovernanceSchema>;

const ASSUMPTIONS = [
  "recent completed training remains directionally representative",
  "the observed strength trend is damped rather than extrapolated at full slope",
  "no future injury, illness, program change, or adherence change is assumed",
] as const;
export function buildFutureMeGovernance(
  lift: DeterministicLiftForecast | null,
  horizon: FutureMeHorizon,
): FutureMeGovernance {
  return FutureMeGovernanceSchema.parse({
    kind: "simulation",
    horizon,
    outputAvailable: lift !== null && isValidatedFutureMeHorizon(horizon),
    evidenceStrength: lift?.evidenceStrength ?? null,
    assumptions: [...ASSUMPTIONS],
    decisionAuthority: false,
    causalClaimAllowed: false,
    guaranteeAllowed: false,
  });
}
