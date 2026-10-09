import { z } from "zod";
import { CoachHistoryMessageSchema, type CoachHistoryMessage } from "@/lib/coach-message.schema";
import { SupportedLanguageSchema, type SupportedLanguage } from "@/lib/language.schema";

export type CoachHistoryState =
  "signed_out" | "loading" | "refreshing" | "ready" | "unavailable" | "stale" | "outdated";
export type CoachTurn = Readonly<{
  id: string;
  role: "user" | "coach";
  text: string;
  createdAt: string | null;
}>;
export type CoachConversationState = Readonly<{
  historyState: CoachHistoryState;
  hasSnapshot: boolean;
  history: readonly CoachHistoryMessage[];
  local: readonly CoachTurn[];
  draft: string;
  operation: "idle" | "sending" | "clearing";
  confirmClear: boolean;
  unconfirmedQuestion: string | null;
  clearUnconfirmed: boolean;
  clearConfirmed: boolean;
  needsRecheck: boolean;
}>;

type Dependencies = {
  read: () => Promise<unknown>;
  ask: (question: string, language: SupportedLanguage) => Promise<unknown>;
  clear: () => Promise<unknown>;
  report: (reason: "history" | "send" | "clear") => void;
};
const HistoryReply = z.object({ messages: z.array(CoachHistoryMessageSchema).max(200) });
const AnswerReply = z.object({ answer: z.string().trim().min(1) });
const ClearReply = z.object({ ok: z.literal(true) });

export function coachVisibleMessages(state: CoachConversationState): readonly CoachTurn[] {
  return [
    ...state.history.map((row) => ({
      id: `saved:${row.id}`,
      role: row.role,
      text: row.content,
      createdAt: row.createdAt,
    })),
    ...state.local,
  ];
}

/** One mounted owner, no persistence, no provider calls or optimistic saved replies.
 * A read owns only the revision at which it began. Send/clear invalidate older
 * reads before invoking transport. A later explicit read reconciles the server
 * journal only while no mutation is in flight; content is never guessed equal.
 */
export function createCoachConversationSession(deps: Dependencies, authenticated: boolean) {
  const initial: CoachConversationState = Object.freeze({
    historyState: authenticated ? "loading" : "signed_out",
    hasSnapshot: false,
    history: [],
    local: [],
    draft: "",
    operation: "idle",
    confirmClear: false,
    unconfirmedQuestion: null,
    clearUnconfirmed: false,
    clearConfirmed: false,
    needsRecheck: false,
  });
  let state = initial;
  let active = false;
  let generation = 0;
  let revision = 0;
  let reading: number | null = null;
  let nextTurn = 0;
  let draftRevision = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<CoachConversationState>) => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  };
  const current = (life: number, ticket: number) =>
    active && authenticated && generation === life && revision === ticket;
  const report = (reason: "history" | "send" | "clear") => {
    // Observability must not turn an already handled transport failure into an
    // unhandled rejection, nor log questions, server replies or account details.
    try {
      deps.report(reason);
    } catch {
      /* Fixed-code reporting is best effort. */
    }
  };
  const invalidateRead = () => {
    revision++;
    reading = null;
  };

  const load = async (): Promise<boolean> => {
    if (
      !active ||
      !authenticated ||
      reading !== null ||
      state.operation !== "idle" ||
      state.confirmClear
    )
      return false;
    const life = generation,
      ticket = ++revision;
    reading = ticket;
    publish({ historyState: state.hasSnapshot ? "refreshing" : "loading", clearConfirmed: false });
    try {
      const reply = HistoryReply.parse(await deps.read());
      if (!current(life, ticket)) return false;
      if (new Set(reply.messages.map((row) => row.id)).size !== reply.messages.length)
        throw new Error("Duplicate journal identity");
      publish({
        history: Object.freeze(reply.messages.map((row) => Object.freeze(row))),
        local: [],
        hasSnapshot: true,
        historyState: "ready",
        needsRecheck: false,
        clearUnconfirmed: false,
      });
      return true;
    } catch {
      if (!current(life, ticket)) return false;
      publish({ historyState: state.hasSnapshot ? "stale" : "unavailable" });
      report("history");
      return false;
    } finally {
      if (current(life, ticket)) reading = null;
    }
  };

  const send = async (language: SupportedLanguage, suggestion?: string): Promise<boolean> => {
    if (
      !active ||
      !authenticated ||
      state.operation !== "idle" ||
      state.needsRecheck ||
      state.confirmClear
    )
      return false;
    const raw = suggestion ?? state.draft;
    const question = raw.trim();
    if (!question || question.length > 1000 || !SupportedLanguageSchema.safeParse(language).success)
      return false;
    // A quick question may not erase an independently composed draft.
    const submittedDraft = suggestion === undefined || state.draft === "";
    const draftAtStart = suggestion !== undefined && state.draft === "" ? suggestion : state.draft;
    invalidateRead();
    const life = generation,
      ticket = revision;
    const submittedRevision = draftRevision;
    const turn: CoachTurn = Object.freeze({
      id: `visit:${++nextTurn}`,
      role: "user",
      text: question,
      createdAt: null,
    });
    publish({
      operation: "sending",
      historyState: "outdated",
      draft: draftAtStart,
      clearConfirmed: false,
      local: Object.freeze([...state.local, turn]),
      unconfirmedQuestion: null,
    });
    try {
      const reply = AnswerReply.parse(await deps.ask(question, language));
      if (!current(life, ticket)) return false;
      publish({
        operation: "idle",
        draft:
          submittedDraft && draftRevision === submittedRevision && state.draft === draftAtStart
            ? ""
            : state.draft,
        local: Object.freeze([
          ...state.local,
          Object.freeze({
            id: `visit:${++nextTurn}`,
            role: "coach",
            text: reply.answer,
            createdAt: null,
          }),
        ]),
      });
      return true;
    } catch {
      if (!current(life, ticket)) return false;
      publish({ operation: "idle", unconfirmedQuestion: question, needsRecheck: true });
      report("send");
      return false;
    }
  };

  const canClear = () =>
    active &&
    authenticated &&
    state.operation === "idle" &&
    state.historyState === "ready" &&
    !state.needsRecheck &&
    state.history.length > 0;
  const clear = async (): Promise<boolean> => {
    if (!canClear() || !state.confirmClear) return false;
    invalidateRead();
    const life = generation,
      ticket = revision;
    publish({ operation: "clearing", confirmClear: false, clearConfirmed: false });
    try {
      ClearReply.parse(await deps.clear());
      if (!current(life, ticket)) return false;
      // A history deletion is not permission to delete an unsent draft.
      publish({
        history: [],
        local: [],
        hasSnapshot: true,
        historyState: "ready",
        operation: "idle",
        clearUnconfirmed: false,
        clearConfirmed: true,
        needsRecheck: false,
        unconfirmedQuestion: null,
      });
      return true;
    } catch {
      if (!current(life, ticket)) return false;
      publish({
        operation: "idle",
        clearUnconfirmed: true,
        needsRecheck: true,
        historyState: "stale",
      });
      report("clear");
      return false;
    }
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (active) return Promise.resolve(false);
      active = true;
      generation++;
      return authenticated ? load() : Promise.resolve(false);
    },
    stop() {
      active = false;
      generation++;
      invalidateRead();
      const sending = state.operation === "sending",
        clearing = state.operation === "clearing";
      publish({
        operation: "idle",
        confirmClear: false,
        needsRecheck: state.needsRecheck || sending || clearing,
        unconfirmedQuestion: sending
          ? (state.local.at(-1)?.text ?? null)
          : state.unconfirmedQuestion,
        clearUnconfirmed: state.clearUnconfirmed || clearing,
      });
    },
    setDraft(draft: string) {
      if (active && authenticated && state.draft !== draft) {
        draftRevision++;
        publish({ draft });
      }
    },
    load,
    send,
    requestClear() {
      if (canClear()) publish({ confirmClear: true });
    },
    cancelClear() {
      publish({ confirmClear: false });
    },
    clear,
  };
}
export type CoachConversationSession = ReturnType<typeof createCoachConversationSession>;
