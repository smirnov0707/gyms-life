import { recordObservabilityEvent } from "./observability.server";

/** Codes the ledger and the metadata schema will both accept. */
const NAMED_FAILURE = /^[A-Z][A-Z0-9_]{2,99}$/;

/** Exported so a test can type its stand-in and still read the event it was given. */
export type ShadowCaptureRecorder = typeof recordObservabilityEvent;

/**
 * Runs a shadow-forecast capture without letting it reach the athlete, and
 * writes down when it breaks.
 *
 * Both captures on the Today path are fail-open, and that is right: a decision
 * about somebody's training must not break because an audit ledger did. They
 * were also fail-silent — `.catch(() => false)` and `.catch(() => undefined)` —
 * and those are not the same property.
 *
 * The cost was that a capture which *declined* and a capture which *threw* were
 * indistinguishable. Production holds 98 decisions and 42 predictions, and
 * nothing in the system can say whether the other 56 had no model artifact, no
 * usable baseline and a day already captured, or whether they failed. The
 * personal-timeline writer failed 233 consecutive times, and the only reason
 * anybody ever found out is that it wrote those failures down.
 *
 * Declining stays silent, because declining is the normal answer and a row per
 * ordinary day would bury the one that matters.
 */
export async function captureShadowPredictionQuietly(
  input: { capture: string; userId: string },
  run: () => Promise<unknown>,
  record: ShadowCaptureRecorder = recordObservabilityEvent,
): Promise<void> {
  try {
    await run();
  } catch (cause) {
    await record({
      eventName: "shadow_prediction.capture",
      outcome: "failure",
      userId: input.userId,
      // A capture that named the rule that refused it keeps its own word. Any
      // other cause is recorded as unnamed rather than pasted in: a thrown
      // message can carry provider or database detail, and a telemetry row read
      // by whoever opens the dashboard is not the place for it.
      errorCode:
        cause instanceof Error && NAMED_FAILURE.test(cause.message)
          ? cause.message
          : "SHADOW_CAPTURE_THREW",
      metadata: { capture: input.capture },
    });
  }
}
