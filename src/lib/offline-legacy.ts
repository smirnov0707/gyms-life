import {
  OfflinePayloadSchema,
  LEGACY_OFFLINE_KEYS,
  type OfflinePayload,
  MAX_QUEUE_ITEMS,
} from "./offline-contract";
export type LegacyOfflineView = {
  status: "absent" | "present" | "unavailable";
  items: OfflinePayload[];
  invalidCount: number;
  limited: boolean;
};
/** Read only. Even malformed or mixed legacy queues remain byte-for-byte untouched. */
export function readLegacyOffline(storage: Pick<Storage, "getItem">): LegacyOfflineView {
  const result: LegacyOfflineView = {
    status: "absent",
    items: [],
    invalidCount: 0,
    limited: false,
  };
  const seen = new Set<string>();
  try {
    for (const key of LEGACY_OFFLINE_KEYS) {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      result.status = "present";
      if (raw.length > 2_000_000) {
        result.invalidCount++;
        result.limited = true;
        continue;
      }
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        result.invalidCount++;
        continue;
      }
      if (!Array.isArray(value)) {
        result.invalidCount++;
        continue;
      }
      for (const item of value) {
        const parsed = OfflinePayloadSchema.safeParse(item);
        if (!parsed.success) {
          result.invalidCount++;
          continue;
        }
        const canonical = JSON.stringify(parsed.data);
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        if (result.items.length >= MAX_QUEUE_ITEMS) {
          result.limited = true;
          continue;
        }
        result.items.push(parsed.data);
      }
    }
  } catch {
    return { status: "unavailable", items: [], invalidCount: 0, limited: false };
  }
  return result;
}
/** Identifies the exact legacy row, not merely its reusable local ID or session ID. */
export async function legacyOfflineDigest(item: OfflinePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(OfflinePayloadSchema.parse(item)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
