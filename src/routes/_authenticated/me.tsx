import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Apple,
  Brain,
  Dumbbell,
  HeartPulse,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingRhythmCard } from "@/components/TrainingRhythmCard";
import { getAthleteModel } from "@/lib/athlete-model.functions";
import type { AthleteModelResponse } from "@/lib/athlete-model.contract";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import {
  correctMemory,
  forgetMemory,
  getUserMemoryTransparency,
  markMemoryIncorrect,
} from "@/lib/user-memory.functions";
import type { MemoryEvidenceState } from "@/lib/memory-evidence.schema";
import type { UserMemorySource, UserMemoryTransparencyItem } from "@/lib/user-memory.schema";
import { displayedMemoryContent, memoryEvidenceSummary } from "@/lib/user-memory.presentation";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Mano sportininko modelis — GYMS.LIFE" },
      {
        name: "description",
        content: "Skaidri, patikrintais duomenimis paremta tavo GYMS.LIFE sportininko būsena.",
      },
    ],
  }),
  component: AthleteModelPage,
});

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  refresh: string;
  updating: string;
  quality: Record<AthleteModelResponse["state"]["dataQuality"]["level"], string>;
  evidence: string;
  transparent: string;
  training: string;
  recovery: string;
  body: string;
  nutrition: string;
  sessions7d: string;
  sessions28d: string;
  volume: string;
  daysSince: string;
  sessionRatings: string;
  averageSessionFeeling: string;
  difficultSessionStreak: string;
  readiness: string;
  sleep: string;
  weight: string;
  weightTrend: string;
  loggedDays: string;
  calories: string;
  protein: string;
  learning: string;
  noGaps: string;
  saved: string;
  unavailable: string;
  error: string;
  memory: {
    eyebrow: string;
    title: string;
    description: string;
    loading: string;
    empty: string;
    source: string;
    evidenceState: string;
    evidenceStateLabel: Record<MemoryEvidenceState, string>;
    evidence: (count: number) => string;
    lastConfirmed: string;
    expires: string;
    updateContext: string;
    correct: string;
    correctionLabel: string;
    correctionHint: string;
    cancel: string;
    saveCorrection: string;
    incorrect: string;
    forget: string;
    correctedSaved: string;
    incorrectSaved: string;
    forgotten: string;
    error: string;
  };
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "DIGITAL ATHLETE",
      title: "Your athlete model",
      description: "A transparent, deterministic summary of the data you have logged in GYMS.LIFE.",
      refresh: "Refresh model",
      updating: "Updating your model…",
      quality: {
        cold_start: "Just getting started",
        building: "Learning from your logs",
        informed: "Evidence-informed",
      },
      evidence: "evidence points",
      transparent: "No guesses: GYMS.LIFE stores only validated aggregate facts here.",
      training: "Training",
      recovery: "Recovery",
      body: "Body",
      nutrition: "Nutrition",
      sessions7d: "sessions / 7d",
      sessions28d: "sessions / 28d",
      volume: "volume / 28d",
      daysSince: "days since session",
      sessionRatings: "your ratings / 28d",
      averageSessionFeeling: "avg session feeling / 28d",
      difficultSessionStreak: "recent difficult ratings (1–2/5)",
      readiness: "latest readiness",
      sleep: "avg sleep / 7d",
      weight: "latest weight",
      weightTrend: "weight change / 30d",
      loggedDays: "logged days / 14d",
      calories: "avg kcal on logged days",
      protein: "avg protein on logged days",
      learning: "What would improve the model",
      noGaps: "Your current data covers every tracked domain.",
      saved: "Historical state saved",
      unavailable: "A source was temporarily unavailable, so no new historical state was saved.",
      error: "Could not load your athlete model. Please try again.",
      memory: {
        eyebrow: "WHAT GYMS.LIFE KNOWS",
        title: "Your active memory",
        description:
          "These are the active facts and patterns GYMS.LIFE can use. You remain in control of them.",
        loading: "Loading your active memory…",
        empty:
          "There are no active memory entries yet. GYMS.LIFE will show facts only after they exist.",
        source: "Source",
        evidenceState: "Evidence status",
        evidenceStateLabel: {
          user_confirmed: "You confirmed this",
          measured_record: "Recorded by measurement or wearable",
          calculated_threshold_met: "Recorded-data threshold met",
          hypothesis_needs_confirmation: "Needs your confirmation",
          experiment_in_progress: "Under observation",
          system_record: "System record",
          requires_review: "Needs review before use",
        },
        evidence: (count) => `${count} evidence ${count === 1 ? "reference" : "references"}`,
        lastConfirmed: "Last confirmed",
        expires: "Expires",
        updateContext: "Update in Today",
        correct: "Correct",
        correctionLabel: "What should GYMS.LIFE remember instead?",
        correctionHint:
          "Your correction replaces this active memory and remains under your control.",
        cancel: "Cancel",
        saveCorrection: "Save correction",
        incorrect: "Not true",
        forget: "Forget",
        correctedSaved: "Your correction is now the active memory.",
        incorrectSaved: "This memory will no longer be used.",
        forgotten: "This memory was permanently removed.",
        error: "Could not update this memory. Please try again.",
      },
    };
  }
  return {
    eyebrow: "SKAITMENINIS SPORTININKAS",
    title: "Tavo sportininko modelis",
    description: "Skaidri, deterministinė suvestinė iš duomenų, kuriuos užregistravai GYMS.LIFE.",
    refresh: "Atnaujinti modelį",
    updating: "Atnaujinamas tavo modelis…",
    quality: {
      cold_start: "Tik pradedame kaupti duomenis",
      building: "Mokomės iš tavo įrašų",
      informed: "Paremta pakankamais duomenimis",
    },
    evidence: "įrodymo taškai",
    transparent: "Be spėjimų: čia saugomi tik validuoti apibendrinti faktai.",
    training: "Treniruotės",
    recovery: "Atsistatymas",
    body: "Kūnas",
    nutrition: "Mityba",
    sessions7d: "treniruotės / 7 d.",
    sessions28d: "treniruotės / 28 d.",
    volume: "tūris / 28 d.",
    daysSince: "dienos nuo treniruotės",
    sessionRatings: "tavo įvertinimai / 28 d.",
    averageSessionFeeling: "vid. savijauta / 28 d.",
    difficultSessionStreak: "paskutiniai sunkūs įvertinimai (1–2/5)",
    readiness: "naujausias pasiruošimas",
    sleep: "vid. miegas / 7 d.",
    weight: "naujausias svoris",
    weightTrend: "svorio pokytis / 30 d.",
    loggedDays: "logintos dienos / 14 d.",
    calories: "vid. kcal logintomis dienomis",
    protein: "vid. baltymai logintomis dienomis",
    learning: "Kas pagerintų modelį",
    noGaps: "Dabartiniai duomenys apima visas stebimas sritis.",
    saved: "Istorinė būsena išsaugota",
    unavailable:
      "Vienas šaltinis laikinai nepasiekiamas, todėl nauja istorinė būsena nebuvo saugoma.",
    error: "Nepavyko įkelti sportininko modelio. Bandyk dar kartą.",
    memory: {
      eyebrow: "KĄ GYMS.LIFE ŽINO APIE TAVE",
      title: "Tavo aktyvi atmintis",
      description:
        "Tai aktyvūs faktai ir dėsningumai, kuriuos GYMS.LIFE gali naudoti. Tu juos visada valdai.",
      loading: "Įkeliama aktyvi atmintis…",
      empty:
        "Aktyvių atminties įrašų dar nėra. GYMS.LIFE faktus rodys tik tada, kai jie iš tikrųjų atsiras.",
      source: "Šaltinis",
      evidenceState: "Įrodymų būsena",
      evidenceStateLabel: {
        user_confirmed: "Tavo patvirtinta",
        measured_record: "Užregistruota matavimu arba dėvimu įrenginiu",
        calculated_threshold_met: "Pasiektas duomenų pakankamumo slenkstis",
        hypothesis_needs_confirmation: "Reikia tavo patvirtinimo",
        experiment_in_progress: "Stebima eksperimento metu",
        system_record: "Sistemos įrašas",
        requires_review: "Prieš naudojimą reikia peržiūros",
      },
      evidence: (count) => `Įrodymų nuorodos: ${count}`,
      lastConfirmed: "Paskutinį kartą patvirtinta",
      expires: "Galioja iki",
      updateContext: "Keisti Today ekrane",
      correct: "Pataisyti",
      correctionLabel: "Ką GYMS.LIFE turėtų įsiminti vietoje to?",
      correctionHint: "Tavo pataisymas pakeis šį aktyvų įrašą ir liks tavo valdomas.",
      cancel: "Atšaukti",
      saveCorrection: "Išsaugoti pataisymą",
      incorrect: "Neteisinga",
      forget: "Pamiršti",
      correctedSaved: "Tavo pataisymas dabar yra aktyvus įrašas.",
      incorrectSaved: "Šis įrašas daugiau nebus naudojamas.",
      forgotten: "Šis įrašas pašalintas visam laikui.",
      error: "Nepavyko atnaujinti šio atminties įrašo. Bandyk dar kartą.",
    },
  };
}

function numberOrDash(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function dataGapAction(
  gap: string,
  lang: string,
): { label: string; to: "/training" | "/readiness" | "/progress" | "/nutrition" } {
  const isEnglish = lang === "en";
  if (gap.startsWith("training")) {
    return { label: isEnglish ? "Log a workout" : "Užregistruok treniruotę", to: "/training" };
  }
  if (gap.startsWith("recovery")) {
    return { label: isEnglish ? "Check readiness" : "Įvertink pasiruošimą", to: "/readiness" };
  }
  if (gap.startsWith("body")) {
    return { label: isEnglish ? "Log body metrics" : "Įvesk kūno rodiklius", to: "/progress" };
  }
  return { label: isEnglish ? "Log nutrition" : "Užregistruok mitybą", to: "/nutrition" };
}

function memoryTypeLabel(type: UserMemoryTransparencyItem["type"], lang: string): string {
  const english = lang === "en";
  if (type.endsWith("_pattern") || type === "pattern") return english ? "Pattern" : "Dėsningumas";
  const labels: Record<UserMemoryTransparencyItem["type"], string> = {
    preference: english ? "Preference" : "Pirmenybė",
    goal: english ? "Goal" : "Tikslas",
    constraint: english ? "Constraint" : "Apribojimas",
    pattern: english ? "Pattern" : "Dėsningumas",
    fact: english ? "Fact" : "Faktas",
    coaching: english ? "Coaching note" : "Trenerio pastaba",
    nutrition: english ? "Nutrition" : "Mityba",
    training: english ? "Training" : "Treniruotė",
    recovery: english ? "Recovery" : "Atsistatymas",
    behavior: english ? "Behavior" : "Elgsena",
    training_pattern: english ? "Training pattern" : "Treniruočių dėsningumas",
    recovery_pattern: english ? "Recovery pattern" : "Atsistatymo dėsningumas",
    nutrition_pattern: english ? "Nutrition pattern" : "Mitybos dėsningumas",
    coaching_insight: english ? "Coaching insight" : "Trenerio įžvalga",
    discovery: english ? "Discovery" : "Atradimas",
    current_context: english ? "Current context" : "Dabartinis kontekstas",
  };
  return labels[type];
}

function memorySourceLabel(source: UserMemorySource, lang: string): string {
  const english = lang === "en";
  const labels: Record<UserMemorySource, string> = {
    user_reported: english ? "You reported this" : "Nurodyta tavo",
    measured: english ? "Measured" : "Išmatuota",
    wearable: english ? "Wearable data" : "Iš dėvimo įrenginio",
    calculated: english ? "Calculated from logs" : "Apskaičiuota iš įrašų",
    ai_inferred: english ? "AI inference" : "AI išvada",
    experimental: english ? "Personal experiment" : "Asmeninis eksperimentas",
    system_generated: english ? "System-generated" : "Sugeneruota sistemos",
  };
  return labels[source];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3">
      <p className="text-display text-xl text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function AthleteModelPage() {
  const { lang } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const loadModel = useServerFn(getAthleteModel);
  const loadMemory = useServerFn(getUserMemoryTransparency);
  const replaceMemory = useServerFn(correctMemory);
  const rejectMemory = useServerFn(markMemoryIncorrect);
  const removeMemory = useServerFn(forgetMemory);
  const [model, setModel] = useState<AthleteModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<UserMemoryTransparencyItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [pendingMemoryAction, setPendingMemoryAction] = useState<string | null>(null);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [correctedContent, setCorrectedContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMemoryLoading(true);
    try {
      // The model refresh reconciles deterministic memory. Load it first so a
      // newly verified observation is visible without requiring a second tap.
      setModel(await loadModel({ data: timeZone }));
    } catch {
      toast.error(copy.error);
    }
    setLoading(false);

    try {
      setMemories(await loadMemory({}));
    } catch {
      toast.error(copy.memory.error);
    }
    setMemoryLoading(false);
  }, [copy.error, copy.memory.error, loadMemory, loadModel, timeZone]);

  useEffect(() => {
    void load();
  }, [load]);

  const state = model?.state;
  const locale = lang === "en" ? "en-GB" : "lt-LT";

  const changeMemory = async (memoryId: string, action: "incorrect" | "forget") => {
    if (pendingMemoryAction !== null) return;
    setPendingMemoryAction(`${action}:${memoryId}`);
    try {
      if (action === "incorrect") {
        await rejectMemory({ data: { memoryId } });
        toast.success(copy.memory.incorrectSaved);
      } else {
        await removeMemory({ data: { memoryId } });
        toast.success(copy.memory.forgotten);
      }
      setMemories((current) => current.filter((memory) => memory.id !== memoryId));
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null);
        setCorrectedContent("");
      }
    } catch {
      toast.error(copy.memory.error);
    } finally {
      setPendingMemoryAction(null);
    }
  };

  const submitMemoryCorrection = async (memory: UserMemoryTransparencyItem) => {
    if (pendingMemoryAction !== null) return;
    const content = correctedContent.trim();
    if (content.length === 0 || content.length > 400) return;

    setPendingMemoryAction(`correct:${memory.id}`);
    try {
      const result = await replaceMemory({ data: { memoryId: memory.id, content } });
      const confirmedAt = new Date().toISOString();
      setMemories((current) =>
        current.map((item) =>
          item.id === memory.id
            ? {
                ...item,
                id: result.id,
                content,
                source: "user_reported",
                evidenceState: "user_confirmed",
                evidenceCount: 0,
                lastConfirmedAt: confirmedAt,
                expiresAt: null,
              }
            : item,
        ),
      );
      setEditingMemoryId(null);
      setCorrectedContent("");
      toast.success(copy.memory.correctedSaved);
    } catch {
      toast.error(copy.memory.error);
    } finally {
      setPendingMemoryAction(null);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <section className="panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
          </div>
          <Button
            onClick={() => void load()}
            disabled={loading}
            variant="outline"
            className="rounded-full"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {copy.refresh}
          </Button>
        </div>

        {loading && !state ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> {copy.updating}
          </div>
        ) : null}

        {state ? (
          <div className="relative mt-7 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-7" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {copy.quality[state.dataQuality.level]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.dataQuality.evidenceCount} {copy.evidence} · {copy.transparent}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {state ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Dumbbell className="size-5 text-primary" /> {copy.training}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label={copy.sessions7d} value={String(state.training.sessionsLast7Days)} />
                <Metric
                  label={copy.sessions28d}
                  value={String(state.training.sessionsLast28Days)}
                />
                <Metric
                  label={copy.volume}
                  value={`${Math.round(state.training.totalVolumeLast28Days)} kg`}
                />
                <Metric
                  label={copy.daysSince}
                  value={numberOrDash(state.training.daysSinceLastCompletedWorkout)}
                />
                <Metric
                  label={copy.sessionRatings}
                  value={
                    state.training.selfReportedResponse.available
                      ? String(state.training.selfReportedResponse.ratedSessionsLast28Days)
                      : "—"
                  }
                />
                <Metric
                  label={copy.averageSessionFeeling}
                  value={
                    state.training.selfReportedResponse.available
                      ? numberOrDash(
                          state.training.selfReportedResponse.averageFeelingLast28Days,
                          " / 5",
                        )
                      : "—"
                  }
                />
                <Metric
                  label={copy.difficultSessionStreak}
                  value={
                    state.training.selfReportedResponse.available
                      ? String(state.training.selfReportedResponse.recentLowFeelingStreak)
                      : "—"
                  }
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <HeartPulse className="size-5 text-primary" /> {copy.recovery}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label={copy.readiness}
                  value={numberOrDash(state.recovery.latestReadinessScore, "/100")}
                />
                <Metric
                  label={copy.sleep}
                  value={numberOrDash(state.recovery.averageSleepHoursLast7Days, " h")}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Scale className="size-5 text-primary" /> {copy.body}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label={copy.weight}
                  value={numberOrDash(state.body.latestWeightKg, " kg")}
                />
                <Metric
                  label={copy.weightTrend}
                  value={numberOrDash(state.body.weightChangeKgLast30Days, " kg")}
                />
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="flex items-center gap-2 text-xl">
                <Apple className="size-5 text-primary" /> {copy.nutrition}
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric
                  label={copy.loggedDays}
                  value={String(state.nutrition.loggedDaysLast14Days)}
                />
                <Metric
                  label={copy.calories}
                  value={numberOrDash(state.nutrition.averageCaloriesOnLoggedDays)}
                />
                <Metric
                  label={copy.protein}
                  value={numberOrDash(state.nutrition.averageProteinGOnLoggedDays, " g")}
                />
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center gap-2 text-xl">
              <Activity className="size-5 text-primary" /> {copy.learning}
            </h2>
            {state.dataGaps.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {state.dataGaps.map((gap) => {
                  const action = dataGapAction(gap, lang);
                  return (
                    <Button key={gap} asChild size="sm" variant="outline" className="rounded-full">
                      <Link to={action.to}>{action.label}</Link>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{copy.noGaps}</p>
            )}
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              {model.snapshot
                ? `${copy.saved}: ${new Date(model.snapshot.computedAt).toLocaleString(locale)}`
                : copy.unavailable}
            </div>
          </section>
        </>
      ) : null}

      <TrainingRhythmCard />

      <section className="panel p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            {copy.memory.eyebrow}
          </p>
          <h2 className="flex items-center gap-2 text-xl">
            <Brain className="size-5 text-primary" /> {copy.memory.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.memory.description}</p>
        </div>

        {memoryLoading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> {copy.memory.loading}
          </div>
        ) : memories.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-muted-foreground">
            {copy.memory.empty}
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {memories.map((memory) => {
              const correctPending = pendingMemoryAction === `correct:${memory.id}`;
              const incorrectPending = pendingMemoryAction === `incorrect:${memory.id}`;
              const forgetPending = pendingMemoryAction === `forget:${memory.id}`;
              const isEditing = editingMemoryId === memory.id;
              const displayedContent = displayedMemoryContent(memory, lang);
              const evidenceSummary = memoryEvidenceSummary(memory, lang);
              const correctionInvalid =
                correctedContent.trim().length === 0 || correctedContent.trim().length > 400;
              return (
                <article
                  key={memory.id}
                  className="rounded-2xl border border-border bg-surface-2 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                      {memoryTypeLabel(memory.type, lang)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">
                    {displayedContent}
                  </p>
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {evidenceSummary ?? copy.memory.evidence(memory.evidenceCount)}
                  </p>

                  <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-xl bg-background/50 px-3 py-2">
                      <dt className="font-semibold text-foreground">{copy.memory.source}</dt>
                      <dd className="mt-0.5">{memorySourceLabel(memory.source, lang)}</dd>
                    </div>
                    <div className="rounded-xl bg-background/50 px-3 py-2">
                      <dt className="font-semibold text-foreground">{copy.memory.evidenceState}</dt>
                      <dd className="mt-0.5">
                        {copy.memory.evidenceStateLabel[memory.evidenceState]}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-background/50 px-3 py-2">
                      <dt className="font-semibold text-foreground">{copy.memory.lastConfirmed}</dt>
                      <dd className="mt-0.5">
                        {new Date(memory.lastConfirmedAt).toLocaleDateString(locale)}
                      </dd>
                    </div>
                    {memory.expiresAt ? (
                      <div className="rounded-xl bg-background/50 px-3 py-2">
                        <dt className="font-semibold text-foreground">{copy.memory.expires}</dt>
                        <dd className="mt-0.5">
                          {new Date(memory.expiresAt).toLocaleString(locale)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {memory.type === "current_context" ? (
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link to="/">{copy.memory.updateContext}</Link>
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={pendingMemoryAction !== null}
                          onClick={() => {
                            setEditingMemoryId(isEditing ? null : memory.id);
                            setCorrectedContent(isEditing ? "" : displayedContent);
                          }}
                        >
                          <Pencil />
                          {copy.memory.correct}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={pendingMemoryAction !== null}
                          onClick={() => void changeMemory(memory.id, "incorrect")}
                        >
                          {incorrectPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
                          {copy.memory.incorrect}
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-muted-foreground hover:text-destructive"
                      disabled={pendingMemoryAction !== null}
                      onClick={() => void changeMemory(memory.id, "forget")}
                    >
                      {forgetPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      {copy.memory.forget}
                    </Button>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 rounded-xl border border-primary/30 bg-background/50 p-3">
                      <label
                        className="text-sm font-semibold text-foreground"
                        htmlFor={`memory-correction-${memory.id}`}
                      >
                        {copy.memory.correctionLabel}
                      </label>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {copy.memory.correctionHint}
                      </p>
                      <Input
                        id={`memory-correction-${memory.id}`}
                        value={correctedContent}
                        maxLength={400}
                        className="mt-3"
                        onChange={(event) => setCorrectedContent(event.target.value)}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          disabled={pendingMemoryAction !== null || correctionInvalid}
                          onClick={() => void submitMemoryCorrection(memory)}
                        >
                          {correctPending ? <Loader2 className="animate-spin" /> : <Pencil />}
                          {copy.memory.saveCorrection}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          disabled={pendingMemoryAction !== null}
                          onClick={() => {
                            setEditingMemoryId(null);
                            setCorrectedContent("");
                          }}
                        >
                          {copy.memory.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
