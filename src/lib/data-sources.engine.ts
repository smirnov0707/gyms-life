import { LIVE_SIGNAL_IDS, type LiveSignal, type LiveSignalId } from "./live-signals.engine";

/**
 * What the strip above the rail says about where the athlete's numbers come
 * from: whether a source is sending, has gone quiet, has never sent anything,
 * or could not be checked at all.
 *
 * There is deliberately no "all systems operational" here — that is a claim
 * about machinery nobody looked at, and the only honest version of it is what
 * has actually arrived.
 *
 * This was inside the component, untested, and it read a stale source as
 * "Delivering". Every language shipped that word in the present tense, so a
 * watch that last synced three weeks ago told the athlete it was sending —
 * which is the one thing this strip exists to catch.
 */

/** Which signals each source is responsible for. */
export const DEVICE_SIGNALS = [
  "sleep",
  "hrv",
  "restingHr",
  "steps",
  "activeKcal",
] as const satisfies readonly LiveSignalId[];

export const MANUAL_SIGNALS = ["weight", "bodyFat"] as const satisfies readonly LiveSignalId[];

/**
 * `delivering` — something arrived inside the freshness window.
 * `quiet` — this source has delivered before, but nothing lately.
 * `silent` — it has signals to its name and has never delivered one.
 * `unknown` — we could not check.
 */
export type SourceState = "delivering" | "quiet" | "silent" | "unknown";

/**
 * The state of one source, from the signals belonging to it.
 *
 * The order the cases are tried in is the whole content of this function:
 *
 * A fresh reading wins outright. It is something we observed, and one sibling
 * we could not read does not make an arriving measurement less arrived.
 *
 * A failed read then beats both of the quiet answers, for the reason the rest
 * of this app repeats: a source we could not read is not a source with nothing
 * in it, and only one of those is the athlete's problem to act on. `quiet` and
 * `silent` are both claims about their device; `unknown` is a claim about us,
 * and it is the one we can actually stand behind.
 *
 * Then having delivered before beats never having delivered, because the two
 * ask for different things — one is a connection that stopped, the other is a
 * connection never made.
 */
export function sourceState(
  signals: readonly LiveSignal[],
  ids: readonly LiveSignalId[],
): SourceState {
  const mine = signals.filter((signal) => ids.includes(signal.id));
  if (mine.some((signal) => signal.state === "measured")) return "delivering";
  if (mine.some((signal) => signal.state === "unreadable")) return "unknown";
  if (mine.some((signal) => signal.state === "stale")) return "quiet";
  return mine.length ? "silent" : "unknown";
}

/** The most recent day any source produced, or null when none ever has. */
export function newestReading(signals: readonly LiveSignal[]): string | null {
  return signals.reduce<string | null>(
    (newest, signal) =>
      signal.recordedOn && (!newest || signal.recordedOn > newest) ? signal.recordedOn : newest,
    null,
  );
}

/**
 * Whether anything at all could be read.
 *
 * With nothing readable there is no "last reading" to be missing: saying "no
 * readings at all" beside two chips that already say the sources could not be
 * checked would be the strip contradicting itself, and the wrong half is the
 * one that sounds like a fact about the athlete.
 */
export function anythingReadable(signals: readonly LiveSignal[]): boolean {
  return signals.some((signal) => signal.state !== "unreadable");
}

/** Every signal the app has, so a new one cannot go unshown. */
export const ALL_SOURCE_SIGNALS: readonly LiveSignalId[] = LIVE_SIGNAL_IDS;
