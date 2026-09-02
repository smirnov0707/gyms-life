/**
 * Billing stays opt-in until Paddle is fully configured and tested in the
 * deployed environment. Core product access must never depend on unfinished
 * payment infrastructure.
 */
export function isBillingEnabled(): boolean {
  return import.meta.env["VITE_BILLING_ENABLED"] === "true";
}
