import { z } from "zod";
export const OFFLINE_DB_NAME = "gyms_life_offline_v3";
export const LEGACY_OFFLINE_KEYS = [
  "gyms_life_offline_queue_v2",
  "gyms_life_offline_queue_v2.unreadable",
] as const;
export const MAX_QUEUE_ITEMS = 200;
export const OFFLINE_QUEUE_EVENT = "gymslife:offline-queue";
export const OwnerIdSchema = z.string().uuid();
export const WorkoutSetSyncSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseSlug: z.string().min(1).max(120),
  exerciseName: z.string().min(1).max(200),
  setNumber: z.number().finite().int().positive(),
  reps: z.number().finite().int().positive().nullable(),
  weightKg: z.number().finite().nonnegative().nullable(),
  rpe: z.number().finite().min(0).max(10).nullable(),
  done: z.boolean(),
  performedAt: z.string().datetime({ offset: true }).optional(),
});
export type WorkoutSetSync = z.infer<typeof WorkoutSetSyncSchema>;
export const OfflinePayloadSchema = z.object({
  id: z.string().min(1).max(300),
  type: z.literal("workout_set"),
  data: WorkoutSetSyncSchema,
  timestamp: z.number().finite().int().min(0).max(8_640_000_000_000_000),
});
export type OfflinePayload = z.infer<typeof OfflinePayloadSchema>;
export const OfflineRetainedReasonSchema = z.enum([
  "conflict",
  "session_unavailable",
  "session_finished",
  "performed_at_review",
  "invalid_measurement",
  "unavailable",
]);
export type OfflineRetainedReason = z.infer<typeof OfflineRetainedReasonSchema>;
export const OwnedOfflineItemSchema = OfflinePayloadSchema.extend({
  version: z.literal(3),
  id: z.string().uuid(),
  ownerId: OwnerIdSchema,
  lastFailure: OfflineRetainedReasonSchema.optional(),
});
export type OwnedOfflineItem = z.infer<typeof OwnedOfflineItemSchema>;
export const OfflineSyncRequestSchema = z.object({
  ownerId: OwnerIdSchema,
  clientId: z.string().uuid(),
  data: WorkoutSetSyncSchema.extend({ performedAt: z.string().datetime({ offset: true }) }),
});
export type OfflineSyncRequest = z.infer<typeof OfflineSyncRequestSchema>;
export const OfflineSyncReplySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("acknowledged"),
    ownerId: OwnerIdSchema,
    clientId: z.string().uuid(),
    serverSetId: z.string().uuid(),
    data: WorkoutSetSyncSchema.extend({ performedAt: z.string().datetime({ offset: true }) }),
  }),
  z.object({
    status: z.literal("retained"),
    ownerId: OwnerIdSchema,
    clientId: z.string().uuid(),
    reason: OfflineRetainedReasonSchema,
  }),
]);
export type OfflineSyncReply = z.infer<typeof OfflineSyncReplySchema>;
export const LegacyOwnershipRequestSchema = z.object({
  ownerId: OwnerIdSchema,
  sessionIds: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_QUEUE_ITEMS)
    .transform((ids) => [...new Set(ids)]),
});
export const LegacyOwnershipReplySchema = z.object({
  ownerId: OwnerIdSchema,
  sessionIds: z.array(z.string().uuid()).max(MAX_QUEUE_ITEMS),
});
export type OfflineQueueFailure =
  "queue_full" | "storage_rejected" | "storage_unavailable" | "identity_changed";
export class OfflineQueueError extends Error {
  constructor(readonly reason: OfflineQueueFailure) {
    super(`OFFLINE_${reason.toUpperCase()}`);
    this.name = "OfflineQueueError";
  }
}
/** Original action time, not reconnect time. Invalid timestamps are never replaced with now. */
export function syncPayload(item: OfflinePayload): OfflineSyncRequest["data"] {
  const parsed = OfflinePayloadSchema.parse(item);
  return {
    ...parsed.data,
    performedAt: parsed.data.performedAt ?? new Date(parsed.timestamp).toISOString(),
  };
}
/** Semantic execution fields. Localized display names do not change an already performed set. */
export function sameOfflineExecution(left: WorkoutSetSync, right: WorkoutSetSync): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.exerciseSlug === right.exerciseSlug &&
    left.setNumber === right.setNumber &&
    left.reps === right.reps &&
    left.weightKg === right.weightKg &&
    left.rpe === right.rpe &&
    left.done === right.done &&
    left.performedAt !== undefined &&
    right.performedAt !== undefined &&
    Date.parse(left.performedAt) === Date.parse(right.performedAt)
  );
}
export function validOfflineAcknowledgement(item: OwnedOfflineItem, response: unknown): boolean {
  const reply = OfflineSyncReplySchema.safeParse(response);
  return (
    reply.success &&
    reply.data.status === "acknowledged" &&
    reply.data.ownerId === item.ownerId &&
    reply.data.clientId === item.id &&
    sameOfflineExecution(syncPayload(item), reply.data.data)
  );
}
export type OwnedQueueView = { ownerId: string; items: OwnedOfflineItem[]; invalidCount: number };
export type OfflineSyncResult = {
  ownerId: string;
  synced: number;
  remaining: number;
  invalidCount: number;
  cancelled: boolean;
  busy?: boolean;
};
