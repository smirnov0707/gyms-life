import { PaddleEnvironmentSchema } from "./paddle-event.schema";
import { BillingPriceKeySchema, configuredPriceIds } from "./paddle-catalog";
export function paymentEnvironment(): "sandbox" | "live" {
  if (process.env["VITE_BILLING_ENABLED"] !== "true") throw new Error("BILLING_DISABLED");
  const token = process.env["VITE_PAYMENTS_CLIENT_TOKEN"];
  const tokenEnvironment = token?.startsWith("test_")
    ? "sandbox"
    : token?.startsWith("live_")
      ? "live"
      : null;
  const configured = process.env["PADDLE_ENVIRONMENT"]?.trim() || undefined;
  const env = PaddleEnvironmentSchema.parse(configured ?? tokenEnvironment);
  if (tokenEnvironment !== env) throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
  return env;
}
/** All recognized subscriptions must refer to one of this application's prices. */
export function authorizeWebhookPrice(
  environment: "sandbox" | "live",
  nativePriceId: string,
  importedKey: string | null,
): void {
  const ids = configuredPriceIds(environment, process.env["PADDLE_PRICE_MAP"]);
  if (Object.values(ids).includes(nativePriceId)) return;
  const key = BillingPriceKeySchema.safeParse(importedKey);
  if (key.success && (!ids[key.data] || ids[key.data] === nativePriceId)) return;
  throw new Error("PADDLE_UNKNOWN_APPLICATION_PRICE");
}
