import { z } from "zod";
export const PaddleEnvironmentSchema = z.enum(["sandbox", "live"]);
const paddleId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9]{26}$`));
const stamp = z.string().datetime({ offset: true });
const status = z.enum(["active", "trialing", "past_due", "paused", "canceled"]);
const period = z.object({ startsAt: stamp, endsAt: stamp }).nullable();
const types = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.activated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
]);
const Envelope = z.object({
  eventId: paddleId("evt"),
  eventType: z.string().max(100),
  occurredAt: stamp,
});
const Subscription = z.object({
  id: paddleId("sub"),
  customerId: paddleId("ctm"),
  status,
  customData: z.record(z.string(), z.unknown()).nullable().optional(),
  currentBillingPeriod: period,
  scheduledChange: z.object({ action: z.enum(["cancel", "pause", "resume"]) }).nullable(),
  items: z
    .array(
      z.object({
        recurring: z.boolean(),
        price: z.object({
          id: paddleId("pri"),
          productId: paddleId("pro"),
          importMeta: z.object({ externalId: z.string().nullable() }).nullable().optional(),
        }),
        product: z
          .object({ id: paddleId("pro") })
          .nullable()
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});
export type VerifiedSubscriptionPayload = {
  id: string;
  customer_id: string;
  user_id: string | null;
  price_id: string;
  product_id: string;
  status: z.infer<typeof status>;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};
/** Parse AFTER signature verification. Native Paddle IDs never depend on optional import metadata. */
export function normalizePaddleSubscriptionEvent(event: unknown) {
  const envelope = Envelope.parse(event);
  if (!types.has(envelope.eventType)) return null;
  const data = Subscription.parse(z.object({ data: z.unknown() }).parse(event).data);
  const recurring = data.items.filter((item) => item.recurring);
  if (recurring.length !== 1) throw new Error("PADDLE_UNSUPPORTED_SUBSCRIPTION_ITEMS");
  const item = recurring[0]!;
  if (item.product && item.product.id !== item.price.productId)
    throw new Error("PADDLE_PRODUCT_MISMATCH");
  const rawUser = data.customData?.["userId"];
  const userId = rawUser == null ? null : z.string().uuid().parse(rawUser);
  if (
    data.currentBillingPeriod &&
    Date.parse(data.currentBillingPeriod.endsAt) < Date.parse(data.currentBillingPeriod.startsAt)
  )
    throw new Error("PADDLE_INVALID_PERIOD");
  if (envelope.eventType === "subscription.canceled" && data.status !== "canceled")
    throw new Error("PADDLE_INVALID_STATUS");
  const subscription: VerifiedSubscriptionPayload = {
    id: data.id,
    customer_id: data.customerId,
    user_id: userId,
    price_id: item.price.id,
    product_id: item.price.productId,
    status: data.status,
    current_period_start: data.currentBillingPeriod?.startsAt ?? null,
    current_period_end: data.currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end: data.scheduledChange?.action === "cancel",
  };
  return { ...envelope, subscription, importedPriceKey: item.price.importMeta?.externalId ?? null };
}
