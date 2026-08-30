import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { askCoach, listCoachMessages } from "@/lib/plan.functions";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Tavo treneris — GYMS.LIFE" },
      { name: "description", content: "Asmeninis treneris: technika, mityba ir plano korekcijos." },
      { property: "og:title", content: "Tavo treneris — GYMS.LIFE" },
      { property: "og:description", content: "Klausk trenerio, kuris mato tavo planą ir progresą." },
    ],
  }),
  component: CoachPage,
});

type Msg = { role: "user" | "coach"; text: string };

const QUICK: TKey[] = ["coach.q1", "coach.q2", "coach.q3", "coach.q4"];

function CoachPage() {
  const { t, lang } = useI18n();
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.error"));
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
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-5xl">{t("coach.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("coach.sub")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/coach-history">
            <History className="size-4" /> {t("coach.history")}
          </Link>
        </Button>
      </div>

      <div className="panel min-h-[45vh] p-5">
        {messages.length === 0 && !busy && (
          <div className="grid place-items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <Sparkles className="size-7 text-primary" />
            {t("coach.sub")}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {QUICK.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => void run(t(k))}
                  className="press lift rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-surface-2 text-foreground",
              )}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" /> {t("common.loading")}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={send} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("coach.ph")} />
        <Button type="submit" disabled={busy} className="font-bold">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
