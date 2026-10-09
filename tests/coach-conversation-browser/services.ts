import { useSyncExternalStore } from "react";
import type { CoachHistoryMessage } from "@/lib/coach-message.schema";

const query = new URLSearchParams(location.search);
let owner: { id: string } | null = { id: "synthetic-a" };
const listeners = new Set<() => void>();
const snapshot = () => owner;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAuth() { return { user: useSyncExternalStore(subscribe, snapshot, snapshot) }; }
let sequence = 1;
const message = (role: "user" | "coach", content: string): CoachHistoryMessage => ({
  id: `20000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
  role, content, createdAt: "2026-10-01T12:00:00.000Z",
});
const journal = new Map<string, CoachHistoryMessage[]>([
  ["synthetic-a", query.has("empty") ? [] : [message("coach", "Earlier A answer")]],
  ["synthetic-b", [message("coach", "Private B answer")]],
]);
let holdRead = query.has("hold"), holdSend = false, holdClear = false;
let failRead = query.has("fail"), loseSendReply = false, loseClearReply = false;
const reads: Array<{ owner: string }> = [], sends: Array<{ owner: string; question: string }> = [], clears: string[] = [];
const pending: Array<{ owner: string; kind: "read" | "send" | "clear"; resolve: () => void }> = [];
function ownerId() { if (!owner) throw new Error("Forbidden signed-out request"); return owner.id; }
const held = (id: string, kind: "read" | "send" | "clear") => new Promise<void>(resolve => pending.push({ owner: id, kind, resolve }));
export async function listCoachMessages() {
  const id = ownerId(), records = structuredClone(journal.get(id) ?? []), fails = failRead;
  reads.push({ owner: id });
  if (holdRead) await held(id, "read");
  if (fails) throw new Error("Synthetic history unavailable");
  return { messages: records };
}
export async function askCoach({ data }: { data: { question: string; lang: string } }) {
  const id = ownerId(), lost = loseSendReply;
  sends.push({ owner: id, question: data.question });
  if (holdSend) await held(id, "send");
  const answer = `Answer for ${data.question}`;
  journal.set(id, [...(journal.get(id) ?? []), message("user", data.question), message("coach", answer)]);
  if (lost) throw new Error("Synthetic reply lost after saved turn");
  return { answer };
}
export async function clearCoachMessages() {
  const id = ownerId(), lost = loseClearReply;
  clears.push(id);
  if (holdClear) await held(id, "clear");
  journal.set(id, []);
  if (lost) throw new Error("Synthetic reply lost after deletion");
  return { ok: true };
}
export async function getAiPersonalizationConsent() { return { enabled: false }; }
export async function recordAiPersonalizationConsent(): Promise<never> { throw new Error("Forbidden consent mutation in conversation tests"); }
const harness = {
  reads, sends, clears,
  setOwner(id: string | null) { owner = id ? { id } : null; for (const listener of listeners) listener(); },
  setReadFailure(value: boolean) { failRead = value; },
  setHold(kind: "read" | "send" | "clear", value: boolean) {
    if (kind === "read") holdRead = value;
    if (kind === "send") holdSend = value;
    if (kind === "clear") holdClear = value;
  },
  loseReply(kind: "send" | "clear", value: boolean) {
    if (kind === "send") loseSendReply = value; else loseClearReply = value;
  },
  release(kind: "read" | "send" | "clear", id?: string) {
    for (let index = pending.length - 1; index >= 0; index--) {
      const item = pending[index];
      if (item && item.kind === kind && (!id || item.owner === id)) { pending.splice(index, 1); item.resolve(); }
    }
  },
};
declare global { interface Window { __conversationTest: typeof harness; } }
window.__conversationTest = harness;
