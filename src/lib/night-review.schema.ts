import { z } from "zod";
import { IsoDaySchema, IanaTimeZoneSchema } from "./local-day";
import { AthleteHypothesisSchema } from "./athlete-hypothesis.schema";
import { AthleteHypothesisLedgerSummarySchema } from "./athlete-hypothesis-ledger";
const stamp = z.string().datetime({ offset: true });
export const PredictionReviewSchema = z
  .object({
    checked: z.number().int().min(0).max(64),
    evaluated: z.number().int().min(0).max(64),
    independentDays: z.number().int().min(0).max(64),
    pending: z.number().int().min(0).max(64),
    limited: z.boolean(),
  })
  .strict()
  .refine(
    (v) => v.evaluated <= v.checked && v.independentDays <= v.evaluated && v.pending <= v.checked,
    "Invalid prediction review counts",
  );
export type PredictionReview = z.infer<typeof PredictionReviewSchema>;
export const HypothesisReviewSchema = z
  .object({
    current: z.array(AthleteHypothesisSchema).max(16),
    transitions: z.array(AthleteHypothesisLedgerSummarySchema).max(16),
  })
  .strict();
export type HypothesisReview = z.infer<typeof HypothesisReviewSchema>;
export const NightReviewSchema = z
  .object({
    version: z.literal("1.0"),
    runKey: IsoDaySchema,
    reviewOn: IsoDaySchema,
    timeZone: IanaTimeZoneSchema,
    evidenceThrough: stamp,
    reviewedAt: stamp,
    status: z.enum(["completed", "partial", "blocked"]),
    snapshot: z.discriminatedUnion("status", [
      z.object({ status: z.literal("confirmed"), id: z.string().uuid() }).strict(),
      z
        .object({
          status: z.literal("blocked"),
          reasons: z.array(z.string().regex(/^[a-z_]{1,80}$/)).max(20),
        })
        .strict(),
      z.object({ status: z.literal("unavailable") }).strict(),
    ]),
    predictions: z.discriminatedUnion("status", [
      z.object({ status: z.literal("completed"), result: PredictionReviewSchema }).strict(),
      z.object({ status: z.enum(["unavailable", "not_run"]) }).strict(),
    ]),
    hypotheses: z.discriminatedUnion("status", [
      z.object({ status: z.literal("completed"), result: HypothesisReviewSchema }).strict(),
      z.object({ status: z.enum(["unavailable", "not_run"]) }).strict(),
    ]),
    modelChanged: z.literal(false),
    planChanged: z.literal(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    const completed =
      v.snapshot.status === "confirmed" &&
      v.predictions.status === "completed" &&
      !v.predictions.result.limited &&
      v.hypotheses.status === "completed";
    const expected =
      v.snapshot.status !== "confirmed" ? "blocked" : completed ? "completed" : "partial";
    if (v.status !== expected)
      ctx.addIssue({ code: "custom", message: "Review status does not match confirmed stages" });
    if (
      v.snapshot.status !== "confirmed" &&
      (v.predictions.status !== "not_run" || v.hypotheses.status !== "not_run")
    )
      ctx.addIssue({ code: "custom", message: "Untrusted snapshot cannot feed learning stages" });
    if (Date.parse(v.reviewedAt) < Date.parse(v.evidenceThrough))
      ctx.addIssue({ code: "custom", message: "Review predates its evidence cutoff" });
  });
export type NightReview = z.infer<typeof NightReviewSchema>;
export const NightReviewReadSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("not_run") }).strict(),
  z.object({ state: z.literal("unavailable") }).strict(),
  z
    .object({ state: z.literal("ready"), reviewId: z.string().uuid(), review: NightReviewSchema })
    .strict(),
]);
export type NightReviewRead = z.infer<typeof NightReviewReadSchema>;
