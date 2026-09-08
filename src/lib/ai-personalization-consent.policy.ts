/**
 * The disclosed data scope this consent is consent *to*.
 *
 * Bumping it invalidates every stored consent, because
 * `hasCurrentAiPersonalizationConsent` requires an exact match. That is the
 * point: a person agreed to a specific description of what leaves the product,
 * and if the description changes they have not agreed to the new one.
 *
 * This bump is a correction rather than a widening. The previous description
 * said, in both languages, that chat history is never sent. `askCoach` reads
 * the last ten turns of the conversation and puts them in the system prompt —
 * deliberately, and its own comment says why: a coach that loses the history
 * answers as if the conversation had never happened. The behaviour was right
 * and the sentence describing it was wrong, so the sentence changed, and
 * consent given against the wrong one does not carry over.
 */
export const AI_PERSONALIZATION_POLICY_VERSION = "2026-09-08-coach-turns-v1";

/** Only the current, explicit consent can authorize the current data scope. */
export function hasCurrentAiPersonalizationConsent(
  granted: boolean,
  policyVersion: string | null,
): boolean {
  return granted && policyVersion === AI_PERSONALIZATION_POLICY_VERSION;
}
