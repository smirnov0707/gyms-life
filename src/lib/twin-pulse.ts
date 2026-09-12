import type { LiveSignal, LiveSignalId } from "./live-signals.engine";

export type TwinPulseDirection = "rising" | "falling" | "stable" | "uncertain";
export type TwinPulseState = "build" | "steady" | "protect" | "uncertain";
export type TwinPulseFactor = {
  id: LiveSignalId;
  direction: TwinPulseDirection;
  delta: number | null;
};
export type TwinPulse = {
  state: TwinPulseState;
  direction: TwinPulseDirection;
  factors: TwinPulseFactor[];
  measuredFactorCount: number;
  decisionAuthority: false;
};

const recoveryIds = new Set<LiveSignalId>(["sleep", "hrv", "restingHr"]);

function signalDirection(signal: LiveSignal): TwinPulseDirection {
  if (signal.state !== "measured" || signal.delta === null) return "uncertain";
  if (signal.delta === 0) return "stable";
  const positive = signal.id === "restingHr" ? signal.delta < 0 : signal.delta > 0;
  return positive ? "rising" : "falling";
}

export function buildTwinPulse(signals: readonly LiveSignal[]): TwinPulse {
  const factors = signals
    .filter((s) => recoveryIds.has(s.id))
    .map((s) => ({ id: s.id, direction: signalDirection(s), delta: s.delta }));
  const known = factors.filter((factor) => factor.direction !== "uncertain");
  const rising = known.filter((factor) => factor.direction === "rising").length;
  const falling = known.filter((factor) => factor.direction === "falling").length;
  const direction: TwinPulseDirection =
    known.length < 2
      ? "uncertain"
      : rising > falling
        ? "rising"
        : falling > rising
          ? "falling"
          : "stable";
  const state: TwinPulseState =
    direction === "uncertain"
      ? "uncertain"
      : direction === "rising"
        ? "build"
        : direction === "falling"
          ? "protect"
          : "steady";
  return { state, direction, factors, measuredFactorCount: known.length, decisionAuthority: false };
}

export type SinceYesterdayItem = {
  id: LiveSignalId;
  direction: Exclude<TwinPulseDirection, "uncertain">;
  delta: number;
};
export function buildSinceYesterday(signals: readonly LiveSignal[]): SinceYesterdayItem[] {
  return signals.flatMap((signal) => {
    if (signal.state !== "measured" || signal.delta === null || signal.delta === 0) return [];
    const movement = signalDirection(signal);
    if (movement === "uncertain") return [];
    return [{ id: signal.id, direction: movement, delta: signal.delta }];
  });
}
