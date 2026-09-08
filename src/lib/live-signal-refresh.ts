import { LIVE_SIGNAL_IDS, type LiveSignal } from "./live-signals.engine";

export type SignalRefreshOutcome = "refreshed" | "stale" | "empty" | "partial" | "unreadable";

/** A successful HTTP request is not proof that each underlying source answered. */
export function signalRefreshOutcome(signals: readonly LiveSignal[]): SignalRefreshOutcome {
  const known = new Map(signals.map((signal) => [signal.id, signal]));
  if (known.size !== signals.length) return "unreadable";
  const rows = LIVE_SIGNAL_IDS.map((id) => known.get(id));
  const readable = rows.filter((signal) => {
    if (!signal || signal.state === "unreadable") return false;
    return signal.state === "absent" || (signal.value !== null && Number.isFinite(signal.value));
  });
  if (readable.length === 0) return "unreadable";
  if (readable.length !== LIVE_SIGNAL_IDS.length) return "partial";
  if (readable.every((signal) => signal?.state === "absent")) return "empty";
  if (readable.every((signal) => signal?.state === "absent" || signal?.state === "stale"))
    return "stale";
  return "refreshed";
}
