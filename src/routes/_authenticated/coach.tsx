import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Send, Sparkles } from "lucide-react";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CoachMemory } from "@/components/CoachMemory";
import { AiPersonalizationConsentCard } from "@/components/coach/AiPersonalizationConsentCard";
import { CoachConversationProvider } from "@/components/coach/CoachConversationProvider";
import { useCoachConversation } from "@/components/coach/conversation.context";
import { CoachHistoryNotice } from "@/components/coach/CoachHistoryNotice";
import { coachVisibleMessages } from "@/components/coach/conversation.session";
import { conversationCopy } from "@/components/coach/conversation.copy";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Intelligence — GYMS.LIFE" },
      {
        name: "description",
        content:
          "GYMS.LIFE Intelligence dialogas apie Today sprendimus, My Twin būseną ir Lab tyrimus.",
      },
      { property: "og:title", content: "Intelligence — GYMS.LIFE" },
      {
        property: "og:description",
        content:
          "Klausk savo sistemos apie sprendimus, būseną, įrodymus ir modeliuojamus scenarijus.",
      },
    ],
  }),
  component: CoachPage,
});

const QUICK: TKey[] = ["coach.q1", "coach.q2", "coach.q3", "coach.q4"];

function CoachPage() {
  const { user } = useAuth();
  return (
    <CoachConversationProvider key={user?.id ?? "signed-out"} authenticated={Boolean(user)}>
      <CoachConversation />
    </CoachConversationProvider>
  );
}

function CoachConversation() {
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const copy = conversationCopy(lang);
  const { session, state } = useCoachConversation();
  const messages = coachVisibleMessages(state).slice(-20);
  const busy = state.operation !== "idle";
  const signedOut = state.historyState === "signed_out";
  const blocked = busy || signedOut || state.needsRecheck || state.confirmClear;
  const tooLong = state.draft.trim().length > 1000;
  const retryingQuestion = state.unconfirmedQuestion === state.draft.trim();
  const showEmpty = state.historyState === "ready" && messages.length === 0 && !busy;

  return (
    <div
      className="fl-coach-page fl-world-page fl-page-enter mx-auto flex min-h-[calc(100dvh-9rem)] max-w-4xl flex-col"
      data-coach-conversation-page
    >
      <header className="fl-world-header flex flex-wrap items-start justify-between gap-4 pb-5">
        <div>
          <p className="fl-world-kicker flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400 light:text-emerald-700">
            <Sparkles className="size-3.5" /> GYMS.LIFE INTELLIGENCE
          </p>
          <h1 className="fl-world-title mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {english ? "Ask your system" : "Klausk savo sistemos"}
          </h1>
          <p className="fl-world-subtitle mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {english
              ? "Ask why Today chose an action, what your Twin is showing, what the Lab is investigating, or what Future is simulating."
              : "Klausk, kodėl Today pasirinko veiksmą, ką rodo Twin, ką tiria Lab arba ką modeliuoja Future."}
          </p>
        </div>
      </header>

      <section
        className="fl-coach-conversation fl-premium-card relative mt-4 flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[2rem] border border-border bg-surface"
        data-conversation-state={
          busy ? "thinking" : showEmpty ? "idle" : messages.length ? "active" : "unavailable"
        }
        data-coach-history-state={state.historyState}
        data-coach-operation={state.operation}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(65% 65% at 50% 0%, var(--primary-dim), transparent 70%)",
          }}
        />
        <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <CoachHistoryNotice />
          {showEmpty ? (
            <div
              className="fl-coach-empty flex min-h-[260px] flex-col items-center justify-center text-center"
              data-coach-confirmed-empty
            >
              <span className="grid size-14 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("coach.sub")}
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={blocked}
                    onClick={() => void session.send(lang, t(key))}
                    className="min-h-11 rounded-full border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mx-auto grid max-w-3xl gap-5" data-coach-messages>
            {messages.map((message) => (
              <div
                key={message.id}
                data-coach-turn={message.role}
                className={cn(
                  "min-w-0 whitespace-pre-wrap break-words text-sm leading-7",
                  message.role === "user"
                    ? "ml-auto max-w-[82%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                    : "max-w-[92%] border-l border-primary/30 pl-4 text-foreground",
                )}
              >
                {message.text}
              </div>
            ))}
            {busy ? (
              <p
                role="status"
                className="flex items-center gap-2 border-l border-primary/30 pl-4 text-sm text-muted-foreground"
              >
                <Loader2
                  className="size-4 animate-spin text-primary motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {state.operation === "clearing" ? copy.clearing : t("common.loading")}
              </p>
            ) : null}
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void session.send(lang);
          }}
          className="relative border-t border-border bg-surface-2/60 p-3 backdrop-blur-xl sm:p-4"
          data-coach-composer
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-surface-2 p-1.5 focus-within:border-primary/40">
            <Input
              value={state.draft}
              onChange={(event) => session.setDraft(event.target.value)}
              disabled={signedOut}
              aria-label={t("coach.ph")}
              aria-invalid={tooLong}
              placeholder={t("coach.ph")}
              data-coach-draft
              className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={blocked || !state.draft.trim() || tooLong}
              aria-label={retryingQuestion ? copy.sendAgain : t("coach.send")}
              title={retryingQuestion ? copy.sendAgain : t("coach.send")}
              size="icon"
              className="min-h-11 min-w-11 shrink-0 rounded-xl"
              data-coach-send
            >
              <Send className="size-4" />
            </Button>
          </div>
          {tooLong ? (
            <p role="status" className="mt-2 text-sm text-foreground">
              {copy.limit}
            </p>
          ) : null}
        </form>
      </section>
      <details className="fl-luxury-disclosure mt-4 rounded-2xl border border-border bg-surface/70">
        <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-xs font-semibold text-muted-foreground">
          {english ? "Context, memory & privacy" : "Kontekstas, atmintis ir privatumas"}
        </summary>
        <div className="grid gap-4 border-t border-border p-4">
          <CoachMemory />
          <AiPersonalizationConsentCard />
        </div>
      </details>
    </div>
  );
}
