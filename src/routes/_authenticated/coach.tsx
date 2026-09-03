import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getAiPersonalizationConsent,
  recordAiPersonalizationConsent,
} from "@/lib/ai-personalization-consent.functions";
import { askCoach, listCoachMessages } from "@/lib/plan.functions";
import { useI18n, type TKey } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-error";
import { errorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Tavo treneris — GYMS.LIFE" },
      { name: "description", content: "Asmeninis treneris: technika, mityba ir plano korekcijos." },
      { property: "og:title", content: "Tavo treneris — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Klausk trenerio, kuris mato tavo planą ir progresą.",
      },
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

      <AiPersonalizationConsentCard />

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

function AiPersonalizationConsentCard() {
  const { lang, t } = useI18n();
  const getConsent = useServerFn(getAiPersonalizationConsent);
  const recordConsent = useServerFn(recordAiPersonalizationConsent);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const copy =
    lang === "lt"
      ? {
          eyebrow: "AI PRIVATUMAS",
          title: "Leisti asmeninį AI kontekstą",
          description:
            "Įjungus, Coach ir Daily Brief AI tiekėjui perduos tik 7/28/30 dienų suvestines bei iki 12 aktyvių faktų, pirmenybių ir dėsningumų, kuriuos matai ir gali pataisyti sportininko modelyje. Neperduodami žali įrašai, paskyros vardas ar pokalbių istorija.",
          active: "Aktyvuota — galite bet kada atšaukti.",
          inactive: "Išjungta — AI naudoja tik bazinius treniruočių nustatymus.",
          enable: "Įjungti kontekstą",
          disable: "Atšaukti sutikimą",
          saved: "AI privatumo pasirinkimas išsaugotas.",
        }
      : {
          eyebrow: "AI PRIVACY",
          title: "Allow personalized AI context",
          description:
            "When enabled, Coach and Daily Brief send only 7/28/30-day summaries and up to 12 active facts, preferences, and patterns you can inspect and correct in your athlete model. Raw records, your account name, and chat history are never sent.",
          active: "Enabled — you can withdraw this at any time.",
          inactive: "Disabled — AI uses only basic training preferences.",
          enable: "Enable context",
          disable: "Withdraw consent",
          saved: "AI privacy preference saved.",
        };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getConsent();
        if (active) setEnabled(current.enabled);
      } catch (error) {
        if (active) toast.error(errorMessage(error, t("common.error")));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getConsent, t]);

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const recorded = await recordConsent({ data: { granted: !enabled } });
      setEnabled(recorded.enabled);
      toast.success(copy.saved);
    } catch (error) {
      toast.error(errorMessage(error, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{copy.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {loading ? "…" : enabled ? copy.active : copy.inactive}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant={enabled ? "outline" : "default"}
        disabled={loading || saving}
        onClick={toggle}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {enabled ? copy.disable : copy.enable}
      </Button>
    </section>
  );
}
