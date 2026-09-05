import { z } from "zod";
import { PredictionTargetSchema } from "./prediction.schema";

export const IntelligenceModelTypeSchema = z.enum([
  "deterministic",
  "statistical",
  "machine_learning",
  "neural",
  "simulation",
]);

export const IntelligenceModelStatusSchema = z.enum([
  "development",
  "shadow",
  "canary",
  "production",
  "retired",
]);

/**
 * Application-owned model identity. Provider/model SDK names do not replace this
 * registry: Future Lab needs to know which GYMS.LIFE model made a falsifiable
 * claim even if its implementation/provider changes later.
 */
export const IntelligenceModelDescriptorSchema = z
  .object({
    modelId: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(80),
    type: IntelligenceModelTypeSchema,
    status: IntelligenceModelStatusSchema,
    targets: z.array(PredictionTargetSchema).max(16),
    inputContractVersion: z.string().trim().min(1).max(80),
    outputContractVersion: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(500),
  })
  .strict();

export type IntelligenceModelDescriptor = z.infer<typeof IntelligenceModelDescriptorSchema>;
