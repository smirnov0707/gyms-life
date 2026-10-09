import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { makeLabData } from "./data";
import { makePopulatedLabData } from "./populated-data";
import type { LabOverview, LabUnreadableSource } from "@/lib/lab.schema";

const params = new URLSearchParams(location.search);
const source = params.get("source");
const unreadable: LabUnreadableSource[] =
  source === "decisions" || source === "decision_evidence" || source === "decision_outcomes"
    ? [source]
    : [];
const populatedStatus = params.get("hypothesis");
let payload = populatedStatus
  ? makePopulatedLabData(populatedStatus)
  : makeLabData(unreadable, params.get("scenario") === "empty" || source === "decisions");
let failed = params.get("scenario") === "unavailable";
let held = false;
let owner: { id: string } | null = { id: "10000000-0000-4000-8000-000000000001" };
const listeners = new Set<() => void>();
const pending: Array<() => void> = [];
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => owner;
export function useAuth() {
  return { user: useSyncExternalStore(subscribe, snapshot, snapshot) };
}
const requests: Array<{ owner: string | null }> = [];
export async function getLabOverview(): Promise<LabOverview> {
  requests.push({ owner: owner?.id ?? null });
  const response = structuredClone(payload);
  const shouldFail = failed;
  if (held) await new Promise<void>((resolve) => pending.push(resolve));
  if (shouldFail) throw new Error("Synthetic Lab read failure");
  return response;
}
const harness = {
  requests,
  setFailed(value: boolean) {
    failed = value;
  },
  setHeld(value: boolean) {
    held = value;
  },
  setReadable(empty = false) {
    payload =
      populatedStatus && !empty ? makePopulatedLabData(populatedStatus) : makeLabData([], empty);
  },
  release() {
    for (const resolve of pending.splice(0)) resolve();
  },
  setOwner(id: string | null) {
    owner = id ? { id } : null;
    for (const listener of listeners) listener();
  },
};
declare global {
  interface Window {
    __labHarness: typeof harness;
    __labQueries: QueryClient;
  }
}
window.__labHarness = harness;

// Independent live-route panels use synthetic read boundaries. Writes are forbidden.
export async function forecastProgress() {
  return null;
}
export async function listPersonalExperimentHistory() {
  return { experiments: [], outcomes: [] };
}
export async function transitionPersonalExperiment(): Promise<never> {
  throw new Error("Unexpected experiment mutation in read-only Lab acceptance");
}
export async function addPersonalExperimentOutcome(): Promise<never> {
  throw new Error("Unexpected experiment mutation in read-only Lab acceptance");
}
