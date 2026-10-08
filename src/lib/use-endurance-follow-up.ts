import { useCallback, useEffect, useRef, useState } from "react";
import { offlineIdentity } from "./offline-identity";
import { readEnduranceFollowUps, updateEnduranceFollowUps } from "./endurance-follow-up-store";
const changed = "gymslife:endurance-follow-up-changed";

export function useEnduranceFollowUp(ownerId: string | null) {
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const memory = useRef<string[]>([]);
  const load = useCallback(() => {
    if (!ownerId || offlineIdentity.current() !== ownerId) return;
    try {
      const ids = readEnduranceFollowUps(window.sessionStorage, ownerId);
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
    try {
      const ids = updateEnduranceFollowUps(window.sessionStorage, ownerId, sessionId, pending);
      memory.current = ids;
      setSessionIds(ids);
      setStorageUnavailable(false);
      window.dispatchEvent(new Event(changed));
    } catch {
      // Saving the workout already succeeded. Retention failure is secondary.
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
