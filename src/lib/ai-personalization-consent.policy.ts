export const AI_PERSONALIZATION_POLICY_VERSION = "2026-09-03-memory-context-v1";

/** Only the current, explicit consent can authorize the current data scope. */
export function hasCurrentAiPersonalizationConsent(
  granted: boolean,
  policyVersion: string | null,
): boolean {
  return granted && policyVersion === AI_PERSONALIZATION_POLICY_VERSION;
}
