import { describe, expect, it, vi } from "vitest";
import { coachVisibleMessages, createCoachConversationSession } from "./conversation.session";
import { conversationCopy } from "./conversation.copy";
import { SupportedLanguageSchema } from "@/lib/language.schema";

function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const row = (id = 1, content = "Earlier answer", role: "user" | "coach" = "coach") => ({
  id: `20000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  role, content, createdAt: "2026-10-01T12:00:00.000Z",
});
function setup(authenticated = true) {
  const read = vi.fn<() => Promise<unknown>>().mockResolvedValue({ messages: [row()] });
  const ask = vi.fn<() => Promise<unknown>>().mockResolvedValue({ answer: "New answer" });
  const clear = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
  const report = vi.fn();
  const session = createCoachConversationSession({ read, ask, clear, report }, authenticated);
  return { session, read, ask, clear, report };
}

describe("Coach owner session and history", () => {
  it("does not read, send, clear or retain drafts while signed out", async () => {
    const h = setup(false);
    await h.session.start(); h.session.setDraft("secret");
    await h.session.send("en"); h.session.requestClear(); await h.session.clear();
    expect(h.session.getSnapshot().historyState).toBe("signed_out");
    expect(h.session.getSnapshot().draft).toBe("");
    expect(h.read).not.toHaveBeenCalled(); expect(h.ask).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
  });
  it("distinguishes a failed read from a confirmed empty conversation", async () => {
    const h = setup(); h.read.mockRejectedValueOnce(new Error("offline"));
    await h.session.start();
    expect(h.session.getSnapshot().historyState).toBe("unavailable");
    expect(h.session.getSnapshot().hasSnapshot).toBe(false);
    expect(h.report).toHaveBeenCalledWith("history");
    h.read.mockResolvedValueOnce({ messages: [] }); await h.session.load();
    expect(h.session.getSnapshot().historyState).toBe("ready");
    expect(h.session.getSnapshot().hasSnapshot).toBe(true);
  });
  it.each([null, {}, { messages: null }, { messages: [row(), row()] }, { messages: [{ ...row(), role: "system" }] }])("rejects invalid history instead of claiming empty: %j", async reply => {
    const h = setup(); h.read.mockResolvedValueOnce(reply); await h.session.start();
    expect(h.session.getSnapshot().historyState).toBe("unavailable");
    expect(h.session.getSnapshot().hasSnapshot).toBe(false);
  });
  it("retains a previously read snapshot when refresh fails", async () => {
    const h = setup(); await h.session.start();
    const old = h.session.getSnapshot().history;
    h.read.mockRejectedValueOnce(new Error("offline")); await h.session.load();
    expect(h.session.getSnapshot().history).toBe(old);
    expect(h.session.getSnapshot().historyState).toBe("stale");
  });
  it("deduplicates same-tick reads synchronously", async () => {
    const h = setup(), wait = deferred(); h.read.mockReturnValueOnce(wait.promise);
    const pending = h.session.start();
    expect(await h.session.load()).toBe(false); expect(h.read).toHaveBeenCalledTimes(1);
    wait.resolve({ messages: [] }); await pending;
  });
  it("ignores an initial read arriving after a new local question and answer", async () => {
    const h = setup(), wait = deferred(); h.read.mockReturnValueOnce(wait.promise);
    const pending = h.session.start(); h.session.setDraft("New question");
    await h.session.send("en"); wait.resolve({ messages: [row()] }); await pending;
    expect(coachVisibleMessages(h.session.getSnapshot()).map(m => m.text)).toEqual(["New question", "New answer"]);
    expect(h.session.getSnapshot().historyState).toBe("outdated");
    expect(h.ask).toHaveBeenCalledTimes(1);
    h.read.mockResolvedValueOnce({ messages: [row(), row(2, "New question", "user"), row(3, "New answer")] });
    await h.session.load();
    expect(coachVisibleMessages(h.session.getSnapshot()).map(m => m.text)).toEqual(["Earlier answer", "New question", "New answer"]);
    expect(h.ask).toHaveBeenCalledTimes(1);
  });
  it("ignores a failed obsolete read without changing new local turns", async () => {
    const h = setup(), wait = deferred(); h.read.mockReturnValueOnce(wait.promise);
    const pending = h.session.start(); h.session.setDraft("Question"); await h.session.send("en");
    wait.reject(new Error("old failure")); await pending;
    expect(h.session.getSnapshot().local).toHaveLength(2);
    expect(h.report).not.toHaveBeenCalled();
  });
  it("survives StrictMode cleanup/restart without applying the first read", async () => {
    const h = setup(), first = deferred(), second = deferred();
    h.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const a = h.session.start(); h.session.stop(); const b = h.session.start();
    second.resolve({ messages: [row(2, "Current snapshot")] }); await b;
    first.resolve({ messages: [row(1, "Obsolete snapshot")] }); await a;
    expect(coachVisibleMessages(h.session.getSnapshot()).map(m => m.text)).toEqual(["Current snapshot"]);
    expect(h.ask).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
  });
  it("keeps SSR and unchanged snapshots stable, and prior snapshots immutable", async () => {
    const h = setup(), initial = h.session.getSnapshot();
    expect(h.session.getServerSnapshot()).toBe(initial);
    expect(h.session.getSnapshot()).toBe(initial);
    await h.session.start();
    expect(initial.history).toEqual([]); expect(h.session.getServerSnapshot()).toBe(initial);
    expect(Object.isFrozen(h.session.getSnapshot())).toBe(true);
    expect(Object.isFrozen(h.session.getSnapshot().history[0])).toBe(true);
    const listener = vi.fn(), unsubscribe = h.session.subscribe(listener);
    h.session.setDraft("a"); expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe(); h.session.setDraft("b"); expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("Coach send recovery", () => {
  it("retains the exact draft while sending; same-tick activation writes once", async () => {
    const h = setup(), wait = deferred(); await h.session.start(); h.ask.mockReturnValueOnce(wait.promise);
    h.session.setDraft("  My question  "); const sending = h.session.send("en");
    expect(h.session.getSnapshot().draft).toBe("  My question  ");
    expect(await h.session.send("en")).toBe(false); expect(await h.session.load()).toBe(false);
    expect(h.ask).toHaveBeenCalledExactlyOnceWith("My question", "en");
    wait.resolve({ answer: "Answer" }); await sending;
    expect(h.session.getSnapshot().draft).toBe("");
    expect(h.session.getSnapshot().local).toHaveLength(2);
  });
  it("a successful old answer does not erase a newer draft", async () => {
    const h = setup(), wait = deferred(); await h.session.start(); h.ask.mockReturnValueOnce(wait.promise);
    h.session.setDraft("First"); const sending = h.session.send("en"); h.session.setDraft("Next unfinished question");
    wait.resolve({ answer: "First answer" }); await sending;
    expect(h.session.getSnapshot().draft).toBe("Next unfinished question");
  });
  it("quick suggestions do not erase independently composed text", async () => {
    const h = setup(); await h.session.start(); h.session.setDraft("My own draft");
    await h.session.send("lt", "Suggested question");
    expect(h.ask).toHaveBeenCalledExactlyOnceWith("Suggested question", "lt");
    expect(h.session.getSnapshot().draft).toBe("My own draft");
  });
  it.each(["", "   ", "q".repeat(1001)])("rejects blank or oversized questions without truncation", async question => {
    const h = setup(); await h.session.start(); h.session.setDraft(question); await h.session.send("en");
    expect(h.ask).not.toHaveBeenCalled(); expect(h.session.getSnapshot().draft).toBe(question);
  });
  it.each([null, {}, { answer: "" }, { answer: 17 }])("treats a malformed reply as uncertain, never invents an answer: %j", async reply => {
    const h = setup(); await h.session.start(); h.ask.mockResolvedValueOnce(reply); h.session.setDraft("Keep this");
    await h.session.send("en");
    expect(h.session.getSnapshot().draft).toBe("Keep this");
    expect(h.session.getSnapshot().unconfirmedQuestion).toBe("Keep this");
    expect(h.session.getSnapshot().local).toHaveLength(1);
    expect(h.session.getSnapshot().needsRecheck).toBe(true);
    expect(h.report).toHaveBeenCalledWith("send");
    await h.session.send("en"); expect(h.ask).toHaveBeenCalledTimes(1);
  });
  it("a lost reply after a simulated commit recovers only by reading", async () => {
    const h = setup(); await h.session.start();
    h.ask.mockImplementationOnce(async () => {
      h.read.mockResolvedValue({ messages: [row(2, "Question", "user"), row(3, "Saved answer")] });
      throw new Error("Reply lost after commit");
    });
    h.session.setDraft("Question"); await h.session.send("en"); await h.session.load();
    expect(h.ask).toHaveBeenCalledTimes(1);
    expect(h.session.getSnapshot().draft).toBe("Question");
    expect(h.session.getSnapshot().unconfirmedQuestion).toBe("Question");
    expect(coachVisibleMessages(h.session.getSnapshot()).map(m => m.text)).toEqual(["Question", "Saved answer"]);
    expect(h.session.getSnapshot().needsRecheck).toBe(false);
  });
  it("failed recovery never unlocks another send or clears the draft", async () => {
    const h = setup(); await h.session.start(); h.ask.mockRejectedValueOnce(new Error("lost"));
    h.session.setDraft("Keep"); await h.session.send("en");
    h.read.mockRejectedValueOnce(new Error("offline")); await h.session.load(); await h.session.send("en");
    expect(h.ask).toHaveBeenCalledTimes(1); expect(h.session.getSnapshot().draft).toBe("Keep");
    expect(h.session.getSnapshot().needsRecheck).toBe(true);
  });
  it("an unmounted owner's reply cannot reach a new owner", async () => {
    const a = setup(), b = setup(), wait = deferred(); await a.session.start(); a.ask.mockReturnValueOnce(wait.promise);
    a.session.setDraft("A private question"); const sending = a.session.send("en"); a.session.stop(); await b.session.start();
    wait.resolve({ answer: "A private answer" }); await sending;
    expect(a.session.getSnapshot().local).toHaveLength(1);
    expect(b.session.getSnapshot().draft).toBe(""); expect(b.session.getSnapshot().local).toHaveLength(0);
    expect(b.ask).not.toHaveBeenCalled();
  });
  it("stop/start never replays a pending AI call", async () => {
    const h = setup(), wait = deferred(); await h.session.start(); h.ask.mockReturnValueOnce(wait.promise);
    h.session.setDraft("Question"); const sending = h.session.send("en"); h.session.stop(); await h.session.start();
    wait.resolve({ answer: "Obsolete answer" }); await sending;
    expect(h.ask).toHaveBeenCalledTimes(1); expect(h.session.getSnapshot().draft).toBe("Question");
    expect(h.session.getSnapshot().unconfirmedQuestion).toBe("Question");
  });
});

describe("Coach shared history deletion", () => {
  it("requires a confirmed history and a second explicit activation", async () => {
    const h = setup(); await h.session.start();
    expect(await h.session.clear()).toBe(false); h.session.requestClear();
    expect(h.session.getSnapshot().confirmClear).toBe(true);
    h.session.cancelClear(); await h.session.clear(); expect(h.clear).not.toHaveBeenCalled();
  });
  it("successful clear updates the shared journal and retains an unsent draft", async () => {
    const h = setup(), wait = deferred(); await h.session.start(); h.clear.mockReturnValueOnce(wait.promise);
    h.session.setDraft("Unsent question"); h.session.requestClear(); const clearing = h.session.clear();
    expect(await h.session.clear()).toBe(false); expect(await h.session.send("en")).toBe(false);
    expect(await h.session.load()).toBe(false); expect(h.clear).toHaveBeenCalledTimes(1);
    wait.resolve({ ok: true }); await clearing;
    expect(coachVisibleMessages(h.session.getSnapshot())).toEqual([]);
    expect(h.session.getSnapshot().draft).toBe("Unsent question");
    expect(h.session.getSnapshot().historyState).toBe("ready");
  });
  it("cannot clear while sending or while the history is unknown", async () => {
    const h = setup(), wait = deferred(); h.read.mockRejectedValueOnce(new Error("offline")); await h.session.start();
    h.session.requestClear(); await h.session.clear(); expect(h.clear).not.toHaveBeenCalled();
    await h.session.load(); h.ask.mockReturnValueOnce(wait.promise); h.session.setDraft("Question");
    const sending = h.session.send("en"); h.session.requestClear(); await h.session.clear();
    expect(h.clear).not.toHaveBeenCalled(); wait.resolve({ answer: "Answer" }); await sending;
  });
  it.each([null, {}, { ok: false }])("a malformed clear acknowledgement is not success: %j", async reply => {
    const h = setup(); await h.session.start(); h.clear.mockResolvedValueOnce(reply);
    h.session.requestClear(); await h.session.clear();
    expect(h.session.getSnapshot().history).toHaveLength(1);
    expect(h.session.getSnapshot().clearUnconfirmed).toBe(true);
    expect(h.session.getSnapshot().historyState).toBe("stale");
    h.session.requestClear(); await h.session.clear(); expect(h.clear).toHaveBeenCalledTimes(1);
  });
  it("a lost clear reply can reconcile an empty history without repeating deletion", async () => {
    const h = setup(); await h.session.start();
    h.clear.mockImplementationOnce(async () => { h.read.mockResolvedValue({ messages: [] }); throw new Error("lost"); });
    h.session.requestClear(); await h.session.clear(); await h.session.load();
    expect(h.clear).toHaveBeenCalledTimes(1); expect(h.session.getSnapshot().history).toEqual([]);
    expect(h.session.getSnapshot().clearUnconfirmed).toBe(false);
  });
  it("obsolete clear results do not affect a newly mounted session", async () => {
    const h = setup(), wait = deferred(); await h.session.start(); h.clear.mockReturnValueOnce(wait.promise);
    h.session.requestClear(); const clearing = h.session.clear(); h.session.stop(); await h.session.start();
    wait.resolve({ ok: true }); await clearing;
    expect(h.session.getSnapshot().history).toHaveLength(1); expect(h.clear).toHaveBeenCalledTimes(1);
  });
});

describe("conversation copy fallback", () => {
  it.each(SupportedLanguageSchema.options)("uses LT only for Lithuanian; truthful states for %s", language => {
    const copy = conversationCopy(language);
    expect(copy.history.unavailable).toBe(language === "lt" ? conversationCopy("lt").history.unavailable : conversationCopy("en").history.unavailable);
    expect(new Set(Object.values(copy.history)).size).toBe(7);
    expect(copy.sendUnconfirmed).not.toBe(copy.clearUnconfirmed);
    expect(copy.retry).not.toBe(copy.sendAgain);
  });
});
