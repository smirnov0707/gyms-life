import { useCallback, useEffect, useRef, useState } from "react";
import { offlineIdentity } from "./offline-identity";
import { readEnduranceFollowUps, updateEnduranceFollowUps } from "./endurance-follow-up-store";
const changed = "gymslife:endurance-follow-up-changed";

export function useEnduranceFollowUp(ownerId: string | null) {
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const memory = useRef<string[]>([]);
  const pendingWrites = useRef(new Map<string, boolean>());
  const load = useCallback(() => {
    if (!ownerId || offlineIdentity.current() !== ownerId) return;
    try {
      let ids = readEnduranceFollowUps(window.sessionStorage, ownerId);
      // Reading an empty queue is not proof that an earlier refused write
      // succeeded. Reconcile local changes before clearing the warning.
      for (const [id, pending] of pendingWrites.current) {
        ids = updateEnduranceFollowUps(window.sessionStorage, ownerId, id, pending);
        pendingWrites.current.delete(id);
      }
      memory.current = ids;
      setSessionIds(ids);
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
      console.warn("[Endurance] FOLLOW_UP_READ_UNAVAILABLE");
    }
  }, [ownerId]);
  useEffect(() => {
    load();
    window.addEventListener(changed, load);
    return () => window.removeEventListener(changed, load);
  }, [load]);
  const remember = (sessionId: string, pending: boolean) => {
    if (!ownerId || offlineIdentity.current() !== ownerId) return;
    pendingWrites.current.set(sessionId, pending);
    try {
      const ids = updateEnduranceFollowUps(window.sessionStorage, ownerId, sessionId, pending);
      pendingWrites.current.delete(sessionId);
      memory.current = ids;
      setSessionIds(ids);
      setStorageUnavailable(pendingWrites.current.size > 0);
      window.dispatchEvent(new Event(changed));
    } catch {
      // The workout is saved; only the local continuation hint failed.
      memory.current = pending
        ? [...new Set([...memory.current, sessionId])]
        : memory.current.filter((id) => id !== sessionId);
      setSessionIds(memory.current);
      setStorageUnavailable(true);
      console.warn("[Endurance] FOLLOW_UP_RETENTION_UNAVAILABLE");
    }
  };
  return { sessionIds, storageUnavailable, remember, reload: load };
}
