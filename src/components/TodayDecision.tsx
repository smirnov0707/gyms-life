import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowRight,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getTodayDecision, recordTodayDecisionOutcome } from "@/lib/today-decision.functions";
import type {
  TodayDecision,
  TodayDecisionAction,
  TodayDecisionEvidence,
} from "@/lib/today-decision.schema";

type Copy = {
  eyebrow: string;
  evidence: string;
  confidence: string;
  unavailable: string;
  notHelpful: string;
  feedbackRecorded: string;
  feedbackFailed: string;
  alternativePrompt: string;
  action: Record<TodayDecisionAction, { title: string; summary: string; cta: string }>;
  evidenceLabel: Record<TodayDecisionEvidence["key"], (value: string) => string>;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "TODAY'S DECISION",
      evidence: "Why this action",
      confidence: "Decision confidence",
      unavailable: "We couldn't load today's decision. You can still use all training tools.",
      notHelpful: "This doesn't fit today",
      feedbackRecorded: "We recorded your feedback.",
      feedbackFailed: "We couldn't record that feedback. Please try again.",
      alternativePrompt: "Choose a safe alternative:",
      action: {
        generate_training_plan: {
          title: "Build your training plan",
          summary: "There is no active validated plan to train from yet.",
          cta: "Create plan",
        },
        complete_readiness: {
          title: "Check your readiness",
          summary: "A same-day check-in keeps the next training decision safe and relevant.",
          cta: "Check readiness",
        },
        recover: {
          title: "Prioritize recovery today",
          summary:
            "Your reported readiness or temporary context calls for recovery before training volume.",
          cta: "Open recovery check-in",
        },
        train_adapted: {
          title: "Train with today's adaptation",
          summary:
            "We will validate and persist the exact session using today's readiness and active context.",
          cta: "Start adapted session",
        },
        train_as_planned: {
          title: "Train as planned",
          summary: "Your current readiness supports the planned session.",
          cta: "Start session",
        },
        log_nutrition: {
          title: "Close the loop with nutrition",
          summary: "You have already completed a workout today; recovery and fueling come next.",
          cta: "Log nutrition",
        },
      },
      evidenceLabel: {
        active_training_plan: (value) =>
          value === "present"
            ? "An active training plan is ready."
            : "No active training plan is available.",
        today_readiness: (value) =>
          value === "not_recorded"
            ? "Today's readiness has not been recorded."
            : `Today's readiness: ${value}/100.`,
        completed_workout_today: () => "A workout is already completed today.",
        sessions_last_7_days: (value) => `Completed sessions in the last 7 days: ${value}.`,
        load_modifier: (value) => `Validated session load: ${Math.round(Number(value) * 100)}%.`,
        model_data_quality: (value) => `Model data quality: ${value.replace("_", " ")}.`,
        active_life_context: (value) =>
          `Current context considered: ${value.replaceAll("_", " ").replaceAll(",", ", ")}.`,
      },
    };
  }

  return {
    eyebrow: "ŠIANDIENOS SPRENDIMAS",
    evidence: "Kodėl šis veiksmas",
    confidence: "Sprendimo patikimumas",
    unavailable:
      "Nepavyko įkelti šiandienos sprendimo. Visi treniruočių įrankiai vis tiek pasiekiami.",
    notHelpful: "Šis pasiūlymas šiandien netinka",
    feedbackRecorded: "Tavo grįžtamąjį ryšį užregistravome.",
    feedbackFailed: "Nepavyko užregistruoti grįžtamojo ryšio. Bandyk dar kartą.",
    alternativePrompt: "Pasirink saugią alternatyvą:",
    action: {
      generate_training_plan: {
        title: "Sukurk treniruočių planą",
        summary: "Kol kas nėra aktyvaus patikrinto plano, pagal kurį būtų saugu treniruotis.",
        cta: "Kurti planą",
      },
      complete_readiness: {
        title: "Įvertink pasiruošimą",
        summary:
          "Šiandienos check-in leidžia saugiai ir tiksliai parinkti kitą treniruotės veiksmą.",
        cta: "Įvertinti pasiruošimą",
      },
      recover: {
        title: "Šiandien pirmiausia atsistatymas",
        summary:
          "Tavo nurodytas pasiruošimas arba laikinas kontekstas rodo, kad prieš treniruotės apimtį reikia atsigauti.",
        cta: "Atidaryti atsistatymo check-in",
      },
      train_adapted: {
        title: "Treniruokis su šiandienos adaptacija",
        summary:
          "Prieš pirmą setą parinksime ir išsaugosime tikslią sesiją pagal pasiruošimą bei dabartinį kontekstą.",
        cta: "Pradėti adaptuotą treniruotę",
      },
      train_as_planned: {
        title: "Treniruokis pagal planą",
        summary: "Dabartinis pasiruošimas palaiko suplanuotą treniruotę.",
        cta: "Pradėti treniruotę",
      },
      log_nutrition: {
        title: "Užbaik ratą mityba",
        summary:
          "Šiandienos treniruotė jau atlikta — toliau svarbiausia atsistatymas ir maitinimas.",
        cta: "Registruoti mitybą",
      },
    },
    evidenceLabel: {
      active_training_plan: (value) =>
        value === "present"
          ? "Aktyvus treniruočių planas paruoštas."
          : "Aktyvaus treniruočių plano nėra.",
      today_readiness: (value) =>
        value === "not_recorded"
          ? "Šiandienos pasiruošimas dar neįvertintas."
          : `Šiandienos pasiruošimas: ${value}/100.`,
      completed_workout_today: () => "Šiandien jau yra baigta treniruotė.",
      sessions_last_7_days: (value) => `Baigtos treniruotės per 7 dienas: ${value}.`,
      load_modifier: (value) =>
        `Patikrintas treniruotės krūvis: ${Math.round(Number(value) * 100)}%.`,
      model_data_quality: (value) => `Modelio duomenų kokybė: ${value.replace("_", " ")}.`,
      active_life_context: (value) =>
        `Atsižvelgta į dabartinį kontekstą: ${value.replaceAll("_", " ").replaceAll(",", ", ")}.`,
    },
  };
}

export function TodayDecision({ workoutDay }: { workoutDay?: number | null }) {
  const { lang } = useI18n();
  const copy = copyFor(lang);
  const navigate = useNavigate();
  const fetchDecision = useServerFn(getTodayDecision);
  const recordOutcome = useServerFn(recordTodayDecisionOutcome);
  const [decision, setDecision] = useState<TodayDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "recorded">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setDecision(await fetchDecision({}));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [fetchDecision]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("gymslife:life-context", refresh);
    return () => window.removeEventListener("gymslife:life-context", refresh);
  }, [load]);

  const navigateToAction = (action: TodayDecisionAction) => {
    if (action === "generate_training_plan") {
      navigate({ to: "/onboarding" });
      return;
    }
    if (action === "complete_readiness" || action === "recover") {
      navigate({ to: "/readiness" });
      return;
    }
    if (action === "log_nutrition") {
      navigate({ to: "/nutrition" });
      return;
    }
    if (workoutDay !== null && workoutDay !== undefined) {
      navigate({ to: "/workout/$day", params: { day: String(workoutDay) } });
      return;
    }
    navigate({ to: "/training" });
  };

  const continueToAction = async () => {
    if (!decision || acting || feedbackState === "sending") return;
    setActing(true);
    try {
      await recordOutcome({ data: { decisionId: decision.id, outcome: "accepted" } });
    } catch {
      toast.error(copy.unavailable);
    } finally {
      setActing(false);
    }
    navigateToAction(decision.action);
  };

  const reportNotHelpful = async () => {
    if (!decision || acting || feedbackState !== "idle" || decision.status === "dismissed") return;
    setFeedbackState("sending");
    try {
      await recordOutcome({ data: { decisionId: decision.id, outcome: "not_helpful" } });
      setDecision({ ...decision, status: "dismissed" });
      setFeedbackState("recorded");
    } catch {
      setFeedbackState("idle");
      toast.error(copy.feedbackFailed);
    }
  };

  if (failed) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  if (loading || !decision) {
    return (
      <GlowCard className="panel p-6 md:p-7">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.eyebrow}
        </div>
      </GlowCard>
    );
  }

  const action = copy.action[decision.action];
  const feedbackRecorded = feedbackState === "recorded" || decision.status === "dismissed";
  const alternative = decision.alternatives[0];
  return (
    <GlowCard className="panel relative overflow-hidden border-primary/40 p-6 md:p-7">
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/12 blur-3xl" />
      <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="size-4" /> {copy.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl leading-tight md:text-4xl">{action.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {action.summary}
          </p>
        </div>

        <Button
          size="lg"
          className="press min-h-12 rounded-full px-6 text-sm font-bold"
          disabled={acting}
          onClick={() => void continueToAction()}
        >
          {acting ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
          {action.cta} <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="relative z-10 mt-6 grid gap-3 border-t border-border/70 pt-5 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> {copy.evidence}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {decision.evidence.map((item) => (
            <div
              key={item.position}
              className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
            >
              {copy.evidenceLabel[item.key](item.value)}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HeartPulse className="size-3.5 text-primary" /> {copy.confidence}: {decision.confidence}%
        </div>
        {feedbackRecorded ? (
          <p className="text-xs text-muted-foreground">{copy.feedbackRecorded}</p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-10 self-start rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
            disabled={acting || feedbackState === "sending"}
            onClick={() => void reportNotHelpful()}
          >
            {feedbackState === "sending" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ThumbsDown className="size-3.5" />
            )}
            {copy.notHelpful}
          </Button>
        )}
      </div>

      {feedbackRecorded && alternative ? (
        <div className="relative z-10 mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{copy.alternativePrompt}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 self-start rounded-full px-4 text-xs sm:self-auto"
            onClick={() => navigateToAction(alternative)}
          >
            {copy.action[alternative].cta} <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </GlowCard>
  );
}
