import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logEnduranceActivity } from "./endurance-activity.functions";
import { offlineIdentity } from "./offline-identity";
import {
  isManualEnduranceAcknowledgement,
  type ManualEnduranceSubmission,
} from "./endurance-submission.schema";
import {
  acknowledgeEnduranceSubmission,
  prepareEnduranceSubmission,
  readPendingEnduranceSubmission,
} from "./endurance-submission-store";
import type { EnduranceActivity } from "./endurance-activity.schema";

export function useManualEnduranceSubmission(ownerId: string | null) {
  const send = useServerFn(logEnduranceActivity);
  const live = useRef(false);
  const [pending, setPending] = useState<ManualEnduranceSubmission | null>(null);
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const load = () => {
    if (!ownerId) return;
    try {
      const scope = offlineIdentity.capture(ownerId);
      const saved = readPendingEnduranceSubmission(window.sessionStorage, ownerId);
      scope.assertCurrent();
      setPending(saved);
      setStorageUnavailable(false);
      setReady(true);
    } catch {
      setStorageUnavailable(true);
      setReady(false);
    }
  };
  useEffect(() => {
    live.current = true;
    if (ownerId) {
      try {
        const scope = offlineIdentity.capture(ownerId);
        const saved = readPendingEnduranceSubmission(window.sessionStorage, ownerId);
        scope.assertCurrent();
        setPending(saved);
        setReady(true);
      } catch {
        setStorageUnavailable(true);
      }
    }
    return () => {
      live.current = false;
    };
  }, [ownerId]);

  const submit = async (activity: EnduranceActivity) => {
    if (!ownerId || !ready) throw new Error("ENDURANCE_SUBMISSION_NOT_READY");
    const scope = offlineIdentity.capture(ownerId);
    const submission = prepareEnduranceSubmission(window.sessionStorage, ownerId, activity, () =>
      crypto.randomUUID(),
    );
    scope.assertCurrent();
    setPending(submission);
    let result;
    try {
      result = await send({ data: submission });
    } catch (error) {
      if (!live.current || !scope.isCurrent()) return null;
      throw error;
    }
    if (!live.current || !scope.isCurrent()) return null;
    if (!isManualEnduranceAcknowledgement(submission, result))
      throw new Error("ENDURANCE_SUBMISSION_UNCONFIRMED");
    let cleanupFailed = false;
    try {
      acknowledgeEnduranceSubmission(window.sessionStorage, submission);
      setPending(null);
    } catch {
      cleanupFailed = true;
    }
    return { result, cleanupFailed, created: result.manualSubmission?.disposition === "created" };
  };

  return {
    pending,
    ready,
    storageUnavailable,
    reload: load,
    submit,
    isMounted: () => live.current,
  };
}
