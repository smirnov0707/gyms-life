/**
 * An error whose message was written for the athlete to read.
 *
 * `errorMessage` discards every message it is given, which is right for a
 * transport error and wrong for the four places in the product that had
 * already composed a localized sentence and thrown it. "Reps must be a number",
 * "Reconnect so your sets are saved before finishing the workout" and "No
 * workout scheduled today" were all written, translated, and then replaced at
 * the toast with "Could not save the set" — a message that names no cause and
 * suggests no action, in front of somebody who can only tap the button again.
 *
 * Throwing this instead marks a message as copy rather than diagnostics. It
 * carries no provider, database, or framework text by construction: every
 * instance is a string this repository authored.
 */
export class AthleteFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AthleteFacingError";
  }
}

/**
 * Transport errors may contain database, provider, framework, or user-input
 * details. They are diagnostic data, not user-interface copy. Callers must
 * supply a localized message that is safe to show to the member.
 */
export function errorMessage(error: unknown, fallback: string): string {
  // Only a message this repository wrote for a person to read passes through.
  // Anything else — and that is every error arriving from the network, the
  // database, or a provider — is still replaced by the caller's copy.
  if (error instanceof AthleteFacingError && error.message.trim()) return error.message;
  return fallback;
}
