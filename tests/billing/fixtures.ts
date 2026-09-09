export const USER = "11111111-1111-4111-8111-111111111111";
export const id = (prefix: string, n = 1) => `${prefix}_${String(n).padStart(26, "0")}`;
export const event = (type = "subscription.created", n = 1) => ({
  eventId: id("evt", n),
  eventType: type,
  occurredAt: "2026-09-09T09:00:00Z",
  data: {
    id: id("sub"),
    customerId: id("ctm"),
    status: type === "subscription.canceled" ? "canceled" : "active",
    customData: { userId: USER },
    currentBillingPeriod: { startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
    scheduledChange: null,
    items: [
      {
        recurring: true,
        price: { id: id("pri"), productId: id("pro"), importMeta: { externalId: "vex_monthly" } },
        product: { id: id("pro") },
      },
    ],
  },
});
export const price = (n = 1, key = "vex_monthly") => ({
  id: id("pri", n),
  product_id: id("pro"),
  status: "active",
  billing_cycle: { interval: "month", frequency: 1 },
  unit_price: { amount: "1200", currency_code: "EUR" },
  import_meta: { external_id: key },
});
