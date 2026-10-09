import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { askCoach, listCoachMessages } from "@/lib/plan.functions";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CoachMemory } from "@/components/CoachMemory";
import { AiPersonalizationConsentCard } from "@/components/coach/AiPersonalizationConsentCard";

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

type Msg = { role: "user" | "coach"; text: string };

const QUICK: TKey[] = ["coach.q1", "coach.q2", "coach.q3", "coach.q4"];

function CoachPage() {
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const ask = useServerFn(askCoach);
  const list = useServerFn(listCoachMessages);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await list({ data: { limit: 20 } });
        if (active) setMessages(res.messages.map((m) => ({ role: m.role, text: m.content })));
      } catch {
        /* history is optional */
      }
    })();
    return () => {
      active = false;
    };
  }, [list]);

  const run = useCallback(
    async (question: string) => {
      if (!question || busy) return;
      setQ("");
      setMessages((m) => [...m, { role: "user", text: question }]);
      setBusy(true);
      try {
        const res = await ask({ data: { question, lang } });
        setMessages((m) => [...m, { role: "coach", text: res.answer }]);
      } catch (error) {
        toast.error(aiErrorMessage(error, t));
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, lang, t],
  );

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(q.trim());
  };

  return (
    <div className="fl-coach-page fl-world-page fl-page-enter mx-auto flex min-h-[calc(100dvh-9rem)] max-w-4xl flex-col">
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
          messages.length === 0 && !busy ? "idle" : busy ? "thinking" : "active"
        }
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(65% 65% at 50% 0%, var(--primary-dim), transparent 70%)",
          }}
        />

        <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {messages.length === 0 && !busy ? (
            <div className="fl-coach-empty flex min-h-[260px] flex-col items-center justify-center text-center">
              <span className="grid size-14 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("coach.sub")}
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void run(t(k))}
                    className="rounded-full border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mx-auto grid max-w-3xl gap-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap text-sm leading-7",
                  m.role === "user"
                    ? "ml-auto max-w-[82%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                    : "max-w-[92%] border-l border-primary/30 pl-4 text-foreground",
                )}
              >
                {m.text}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 border-l border-primary/30 pl-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> {t("common.loading")}
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={send}
          className="relative border-t border-border bg-surface-2/60 p-3 backdrop-blur-xl sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-surface-2 p-1.5 focus-within:border-primary/40">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("coach.ph")}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={busy || !q.trim()}
              aria-label={t("coach.send")}
              size="icon"
              className="shrink-0 rounded-xl"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </section>

      <details className="fl-luxury-disclosure mt-4 rounded-2xl border border-border bg-surface/70">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-muted-foreground">
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
