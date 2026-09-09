import { z } from "zod";
export const BillingPriceKeySchema = z.enum(["vex_weekly", "vex_monthly", "vex_yearly"]);
export type BillingPriceKey = z.infer<typeof BillingPriceKeySchema>;
/** Matches the three base EUR prices displayed by the current application. */
export const BILLING_CATALOG = {
  vex_weekly: { amount: "300", interval: "week" },
  vex_monthly: { amount: "1200", interval: "month" },
  vex_yearly: { amount: "4900", interval: "year" },
} as const;
export const NativePriceIdSchema = z.string().regex(/^pri_[a-z0-9]{26}$/);
const EnvPrices = z.partialRecord(BillingPriceKeySchema, NativePriceIdSchema);
const PriceMap = z.object({ sandbox: EnvPrices.optional(), live: EnvPrices.optional() }).strict();
export function configuredPriceIds(
  environment: "sandbox" | "live",
  raw: string | undefined,
): Partial<Record<BillingPriceKey, string>> {
  return raw ? (PriceMap.parse(JSON.parse(raw))[environment] ?? {}) : {};
}
