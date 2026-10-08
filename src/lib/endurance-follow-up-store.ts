import { z } from "zod";

export const ENDURANCE_FOLLOW_UP_PREFIX = "gyms_life_run_follow_up_v1:";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = z.string().uuid();
const queueSchema = z
  .object({
    version: z.literal(1),
    ownerId: uuid,
    sessionIds: z.array(uuid).max(64),
  })
  .strict();

/** Local navigation hints only. The authenticated server rechecks all evidence. */
export function readEnduranceFollowUps(storage: StoragePort, ownerId: string): string[] {
  const owner = uuid.parse(ownerId);
  const raw = storage.getItem(ENDURANCE_FOLLOW_UP_PREFIX + owner);
  if (raw === null) return [];
  const queue = queueSchema.parse(JSON.parse(raw));
  if (queue.ownerId !== owner || new Set(queue.sessionIds).size !== queue.sessionIds.length)
    throw new Error("ENDURANCE_FOLLOW_UP_INVALID");
  return queue.sessionIds;
}

/** Never overwrite an unreadable queue or silently evict another pending check. */
export function updateEnduranceFollowUps(
  storage: StoragePort,
  ownerId: string,
  sessionId: string,
  pending: boolean,
): string[] {
  uuid.parse(sessionId);
  const current = readEnduranceFollowUps(storage, ownerId);
  const next = pending
    ? current.includes(sessionId)
      ? current
      : [...current, sessionId]
    : current.filter((id) => id !== sessionId);
  if (next.length > 64) throw new Error("ENDURANCE_FOLLOW_UP_FULL");
  if (JSON.stringify(current) === JSON.stringify(next)) return next;
  const key = ENDURANCE_FOLLOW_UP_PREFIX + ownerId;
  if (next.length === 0) {
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw new Error("ENDURANCE_FOLLOW_UP_NOT_CLEARED");
  } else {
    const raw = JSON.stringify({ version: 1, ownerId, sessionIds: next });
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw new Error("ENDURANCE_FOLLOW_UP_NOT_RETAINED");
  }
  return next;
}
