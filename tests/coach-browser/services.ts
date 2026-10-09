import { useSyncExternalStore } from "react";

const query = new URLSearchParams(location.search);
let owner: { id: string } | null = { id: "synthetic-a" };
const preferences = new Map([["synthetic-a", true], ["synthetic-b", false]]);
const subscribers = new Set<() => void>();
const reads: Array<{ owner: string }> = [];
const writes: Array<{ owner: string; granted: boolean }> = [];
let readFails = query.get("fail") === "1";
let holdRead = query.get("hold") === "1";
let holdWrite = false;
let loseWriteReply = false;
const pendingReads: Array<{ owner: string; release: () => void }> = [];
const pendingWrites: Array<{ owner: string; release: () => void }> = [];
const snapshot = () => owner;
function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
export function useAuth() {
  return { user: useSyncExternalStore(subscribe, snapshot, snapshot) };
}

export async function getAiPersonalizationConsent() {
  const id = owner?.id;
  if (!id) throw new Error("Unexpected signed-out consent read");
  reads.push({ owner: id });
  const enabled = preferences.get(id) ?? false;
  const fails = readFails;
  if (holdRead) await new Promise<void>((release) => pendingReads.push({ owner: id, release }));
  if (fails) throw new Error("Synthetic unavailable read");
  return { enabled };
}
export async function recordAiPersonalizationConsent({ data }: { data: { granted: boolean } }) {
  const id = owner?.id;
  if (!id) throw new Error("Unexpected signed-out consent write");
  writes.push({ owner: id, granted: data.granted });
  const loseReply = loseWriteReply;
  if (holdWrite) await new Promise<void>((release) => pendingWrites.push({ owner: id, release }));
  preferences.set(id, data.granted);
  if (loseReply) throw new Error("Synthetic reply lost after commit");
  return { enabled: data.granted };
}

// The real Coach page and memory panel mount, but AI and destructive actions are forbidden.
export async function listCoachMessages() { return { messages: [] }; }
export async function askCoach(): Promise<never> { throw new Error("Forbidden live AI action"); }
export async function clearCoachMessages(): Promise<never> { throw new Error("Forbidden history deletion"); }

function releaseOwner(queue: typeof pendingReads, id?: string) {
  for (let index = queue.length - 1; index >= 0; index--) {
    const item = queue[index];
    if (item && (!id || item.owner === id)) {
      queue.splice(index, 1);
      item.release();
    }
  }
}
const harness = {
  reads,
  writes,
  readable() { readFails = false; },
  holdReads(value: boolean) { holdRead = value; },
  holdWrites(value: boolean) { holdWrite = value; },
  loseReply(value: boolean) { loseWriteReply = value; },
  releaseReads(id?: string) { releaseOwner(pendingReads, id); },
  releaseWrites(id?: string) { releaseOwner(pendingWrites, id); },
  setOwner(id: string | null) {
    owner = id ? { id } : null;
    for (const listener of subscribers) listener();
  },
};
declare global { interface Window { __consentTest: typeof harness; } }
window.__consentTest = harness;
