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
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-4xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400 light:text-emerald-700">
            <Sparkles className="size-3.5" /> GYMS.LIFE COACH
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("coach.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("coach.sub")}
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/coach-history">
            <History className="size-4" /> {t("coach.history")}
          </Link>
        </Button>
      </header>

      <AiPersonalizationConsentCard />

      <section className="relative mt-4 flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(65% 65% at 50% 0%, rgba(16,185,129,.08), transparent 70%)",
          }}
        />

        <div className="relative flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {messages.length === 0 && !busy ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <span className="grid size-14 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400">
                <Sparkles className="size-5" />
              </span>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-500">
                {t("coach.sub")}
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {QUICK.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void run(t(k))}
                    className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/[0.04] hover:text-white"
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
                    ? "ml-auto max-w-[82%] rounded-2xl bg-emerald-400 px-4 py-3 text-black"
                    : "max-w-[92%] border-l border-emerald-400/20 pl-4 text-neutral-200",
                )}
              >
                {m.text}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 border-l border-emerald-400/20 pl-4 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin text-emerald-400" /> {t("common.loading")}
              </div>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={send}
          className="relative border-t border-white/[0.06] bg-black/30 p-3 backdrop-blur-xl sm:p-4"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-1.5 focus-within:border-emerald-400/30">
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
          title: "Asmeninis kontekstas",
          description:
            "Coach ir Daily Brief AI tiekėjui gali perduoti tik 7/28/30 dienų suvestines bei iki 12 aktyvių faktų, pirmenybių ir dėsningumų. Neperduodami žali įrašai, paskyros vardas ar pokalbių istorija.",
          active: "Asmeninis kontekstas įjungtas",
          inactive: "Naudojami tik baziniai treniruočių nustatymai",
          enable: "Įjungti",
          disable: "Išjungti",
          saved: "AI privatumo pasirinkimas išsaugotas.",
        }
      : {
          eyebrow: "AI PRIVACY",
          title: "Personal context",
          description:
            "Coach and Daily Brief can send only 7/28/30-day summaries and up to 12 active facts, preferences, and patterns. Raw records, your account name, and chat history are never sent.",
          active: "Personal context enabled",
          inactive: "Using basic training preferences only",
          enable: "Enable",
          disable: "Disable",
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
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl border",
            enabled
              ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-400 light:text-emerald-700"
              : "border-border bg-foreground/[0.03] text-muted-foreground",
          )}
        >
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span>{copy.eyebrow}</span>
            <span
              className={
                enabled ? "text-emerald-400 light:text-emerald-700" : "text-muted-foreground"
              }
            >
              {loading ? "…" : enabled ? copy.active : copy.inactive}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground" title={copy.description}>
            {copy.title}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={loading || saving}
        onClick={toggle}
        className="text-muted-foreground hover:text-foreground"
        title={copy.description}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {enabled ? copy.disable : copy.enable}
      </Button>
    </section>
  );
}
