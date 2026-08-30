import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Apple, Loader2, MessageCircle, Send, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { askCoach } from "@/lib/plan.functions";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlowCard } from "@/components/GlowCard";
import { cn } from "@/lib/utils";
import { aiErrorMessage } from "@/lib/ai-error";

type Msg = { role: "user" | "coach"; text: string };
type Tab = "chat" | "notes" | "nutrition";

const QUICK: TKey[] = ["coach.q1", "coach.q2", "coach.q3", "coach.q4"];

export function CoachDock({
  progression,
  nutrition,
}: {
  progression?: string | undefined;
  nutrition?: string | undefined;
}) {
  const { t, lang } = useI18n();
  const ask = useServerFn(askCoach);
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (question: string) => {
    if (!question || busy) return;
    setQ("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await ask({ data: { question, lang } });
      setMessages((m) => [...m, { role: "coach", text: res.answer }]);
    } catch (err) {
      toast.error(aiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; Icon: typeof Sparkles; show: boolean }[] = [
    { id: "chat", label: t("coach.chatTab"), Icon: MessageCircle, show: true },
    { id: "notes", label: t("coach.notesTab"), Icon: TrendingUp, show: Boolean(progression) },
    { id: "nutrition", label: t("coach.nutriTab"), Icon: Apple, show: Boolean(nutrition) },
  ];

  return (
    <GlowCard className="panel relative overflow-hidden p-6 md:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-primary" />
            </span>
            <div>
              <h3 className="text-2xl leading-none">{t("coach.title")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("coach.sub")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to="/coach-history">{t("coach.history")}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to="/coach">{t("coach.open")}</Link>
            </Button>
          </div>

        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs
            .filter((x) => x.show)
            .map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  tab === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
        </div>

        {tab === "chat" && (
          <div className="mt-4">
            {messages.length === 0 && !busy ? (
              <div className="flex flex-wrap gap-2">
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
            ) : (
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-surface-2 text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" /> {t("common.loading")}
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(q.trim());
              }}
              className="mt-4 flex gap-2"
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("coach.ph")} />
              <Button type="submit" disabled={busy} className="font-bold" aria-label={t("coach.send")}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          </div>
        )}

        {tab === "notes" && progression && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{progression}</p>
        )}
        {tab === "nutrition" && nutrition && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{nutrition}</p>
        )}
      </div>
    </GlowCard>
  );
}
