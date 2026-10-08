import { z } from "zod";
import {
  ManualEnduranceSubmissionSchema,
  sameEnduranceActivity,
  type ManualEnduranceSubmission,
} from "./endurance-submission.schema";
import type { EnduranceActivity } from "./endurance-activity.schema";

const pendingSchema = z
  .object({ version: z.literal(1), submission: ManualEnduranceSubmissionSchema })
  .strict();
const storageKey = (ownerId: string) =>
  `gyms_life_pending_manual_run_v1:${z.string().uuid().parse(ownerId)}`;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export class EnduranceSubmissionStorageError extends Error {
  constructor() {
    super("ENDURANCE_SUBMISSION_STORAGE_UNAVAILABLE");
  }
}
/** Session-only, owner-scoped pending input. Not an authentication token or an offline auto-send queue. */
export function readPendingEnduranceSubmission(
  store: Store,
  ownerId: string,
): ManualEnduranceSubmission | null {
  try {
    const value = store.getItem(storageKey(ownerId));
    if (value === null) return null;
    const pending = pendingSchema.parse(JSON.parse(value)).submission;
    if (pending.ownerId !== ownerId) throw new Error("Owner mismatch");
    return pending;
  } catch {
    throw new EnduranceSubmissionStorageError();
  }
}

/** Retain and verify BEFORE the first network request. Never replace an unresolved attempt. */
export function prepareEnduranceSubmission(
  store: Store,
  ownerId: string,
  activity: EnduranceActivity,
  makeId: () => string,
): ManualEnduranceSubmission {
  try {
    const existing = readPendingEnduranceSubmission(store, ownerId);
    if (existing) return existing;
    const submission = ManualEnduranceSubmissionSchema.parse({
      ownerId,
      submissionId: makeId(),
      activity,
    });
    const raw = JSON.stringify({ version: 1, submission });
    store.setItem(storageKey(ownerId), raw);
    if (store.getItem(storageKey(ownerId)) !== raw) throw new Error("Receipt not retained");
    return submission;
  } catch {
    throw new EnduranceSubmissionStorageError();
  }
}

/** A stale response must not erase a newer attempt, including when storage was changed externally. */
export function acknowledgeEnduranceSubmission(
  store: Store,
  expected: ManualEnduranceSubmission,
): void {
  try {
    const pending = readPendingEnduranceSubmission(store, expected.ownerId);
    if (!pending) return;
    if (
      pending.submissionId !== expected.submissionId ||
      !sameEnduranceActivity(pending.activity, expected.activity)
    )
      throw new Error("Receipt changed");
    store.removeItem(storageKey(expected.ownerId));
    if (store.getItem(storageKey(expected.ownerId)) !== null)
      throw new Error("Receipt not cleared");
  } catch {
    throw new EnduranceSubmissionStorageError();
  }
}
