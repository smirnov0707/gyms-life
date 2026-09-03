/**
 * Transport errors may contain database, provider, framework, or user-input
 * details. They are diagnostic data, not user-interface copy. Callers must
 * supply a localized message that is safe to show to the member.
 */
export function errorMessage(_error: unknown, fallback: string): string {
  return fallback;
}
