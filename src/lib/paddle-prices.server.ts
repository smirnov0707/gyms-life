import { z } from "zod";
import {
  BILLING_CATALOG,
  BillingPriceKeySchema,
  configuredPriceIds,
  NativePriceIdSchema,
} from "./paddle-catalog";
import { gatewayFetch } from "./paddle.server";
const Price = z.object({
  id: NativePriceIdSchema,
  product_id: z.string().regex(/^pro_[a-z0-9]{26}$/),
  status: z.enum(["active", "archived"]),
  billing_cycle: z
    .object({
      interval: z.enum(["day", "week", "month", "year"]),
      frequency: z.number().int().positive(),
    })
    .nullable(),
  unit_price: z.object({ amount: z.string().regex(/^\d+$/), currency_code: z.string() }),
  import_meta: z.object({ external_id: z.string().nullable() }).nullable().optional(),
});
const Page = z.object({
  data: z.array(Price),
  meta: z.object({ pagination: z.object({ has_more: z.boolean(), next: z.string().nullable() }) }),
});
export async function resolveApplicationPrice(
  keyInput: unknown,
  environment: "sandbox" | "live",
  dependencies = { fetch: gatewayFetch, mapping: process.env["PADDLE_PRICE_MAP"] },
) {
  const key = BillingPriceKeySchema.parse(keyInput),
    mapping = configuredPriceIds(environment, dependencies.mapping),
    native = mapping[key];
  let candidate: z.infer<typeof Price> | undefined;
  if (native) {
    candidate = Price.parse(
      z
        .object({ data: Price })
        .parse(await (await dependencies.fetch(environment, `/prices/${native}`)).json()).data,
    );
  } else {
    // external_id is not a supported list filter. Traverse explicit pages and
    // match imported metadata, never assume the first arbitrary price is ours.
    let path = "/prices?status=active&recurring=true&per_page=200";
    const visited = new Set<string>();
    const matches: z.infer<typeof Price>[] = [];
    for (let page = 0; page < 10; page++) {
      if (visited.has(path)) throw new Error("PADDLE_PRICE_PAGINATION_LOOP");
      visited.add(path);
      const result = Page.parse(await (await dependencies.fetch(environment, path)).json());
      matches.push(...result.data.filter((price) => price.import_meta?.external_id === key));
      if (!result.meta.pagination.has_more) {
        if (matches.length !== 1) throw new Error("PADDLE_PRICE_NOT_UNIQUE");
        candidate = matches[0];
        break;
      }
      if (!result.meta.pagination.next) throw new Error("PADDLE_PRICE_PAGE_MISSING");
      const origin =
        environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
      const next = new URL(result.meta.pagination.next, origin);
      if (next.origin !== origin || next.pathname !== "/prices" || next.username || next.password)
        throw new Error("PADDLE_PRICE_PAGE_ORIGIN");
      path = next.pathname + next.search;
    }
  }
  if (!candidate) throw new Error("PADDLE_PRICE_LOOKUP_INCOMPLETE");
  const expected = BILLING_CATALOG[key];
  if (
    (native && candidate.id !== native) ||
    candidate.status !== "active" ||
    candidate.billing_cycle?.interval !== expected.interval ||
    candidate.billing_cycle.frequency !== 1 ||
    candidate.unit_price.currency_code !== "EUR" ||
    candidate.unit_price.amount !== expected.amount
  )
    throw new Error("PADDLE_DISPLAYED_PRICE_MISMATCH");
  return candidate.id;
}
