import { z } from "zod";

export const PersonalizedTwinLifecycleStatusSchema = z.enum([
  "collecting",
  "ready_for_provider",
  "processing",
  "ready",
  "failed",
]);

export type PersonalizedTwinLifecycleStatus = z.infer<typeof PersonalizedTwinLifecycleStatusSchema>;

const ALLOWED: Record<PersonalizedTwinLifecycleStatus, readonly PersonalizedTwinLifecycleStatus[]> =
  {
    collecting: ["collecting", "ready_for_provider"],
    ready_for_provider: ["ready_for_provider", "processing", "failed"],
    processing: ["processing", "ready", "failed"],
    ready: ["ready"],
    failed: ["failed"],
  };
export function assertPersonalizedTwinTransition(input: {
  from: PersonalizedTwinLifecycleStatus;
  to: PersonalizedTwinLifecycleStatus;
  inputDeletedAt?: string | null;
  modelObjectPath?: string | null;
  errorCode?: string | null;
}): void {
  if (!ALLOWED[input.from].includes(input.to)) {
    throw new Error(`PERSONALIZED_TWIN_INVALID_TRANSITION:${input.from}->${input.to}`);
  }
  if (input.to === "ready") {
    if (!input.inputDeletedAt) throw new Error("PERSONALIZED_TWIN_INPUT_CLEANUP_REQUIRED");
    if (!input.modelObjectPath) throw new Error("PERSONALIZED_TWIN_MODEL_REQUIRED");
  }
  if (input.to === "failed") {
    if (!input.inputDeletedAt) throw new Error("PERSONALIZED_TWIN_INPUT_CLEANUP_REQUIRED");
    if (!input.errorCode) throw new Error("PERSONALIZED_TWIN_ERROR_CODE_REQUIRED");
  }
}
