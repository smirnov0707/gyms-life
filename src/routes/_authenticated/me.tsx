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
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingRhythmCard } from "@/components/TrainingRhythmCard";
import { getAthleteModel } from "@/lib/athlete-model.functions";
import type { AthleteModelResponse } from "@/lib/athlete-model.contract";
import { baseLang, formatLocale, useI18n, type Lang } from "@/lib/i18n";
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
import { getProfileBody, ProfileBodySchema, saveProfileBody } from "@/lib/profile-body.functions";

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
  bodyFacts: {
    eyebrow: string;
    title: string;
    sub: string;
    height: string;
    birthYear: string;
    gender: string;
    targetWeight: string;
    unset: string;
    missing: (fields: string) => string;
    weightNote: string;
    save: string;
    saved: string;
    invalid: string;
  };
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
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
      bodyFacts: {
        eyebrow: "YOUR BODY",
        title: "What the model measures against",
        sub: "Height, year of birth and sex are what the meal plan, the micronutrient scan and the body scan's age term reason from. Left blank, each of those says so rather than assuming a body.",
        height: "Height (cm)",
        birthYear: "Year of birth",
        gender: "Sex",
        targetWeight: "Target weight (kg)",
        unset: "Not set",
        missing: (fields) =>
          `Still unknown: ${fields}. Anything that needs one of these will say so instead of estimating.`,
        weightNote:
          "Body weight is not here on purpose: it is a measurement with a date, recorded on the progress page, and the latest one is what every calculation uses.",
        save: "Save",
        saved: "Saved.",
        invalid:
          "Check the values: height 120-230 cm, year of birth within the last century, target weight 30-300 kg.",
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
    bodyFacts: {
      eyebrow: "TAVO KŪNAS",
      title: "Į ką modelis atsiremia",
      sub: "Ūgis, gimimo metai ir lytis yra tai, iš ko samprotauja mitybos planas, mikroelementų skenavimas ir kūno skenavimo amžiaus narys. Palikti tuščius, jie tai pasako, o ne prisigalvoja kūną.",
      height: "Ūgis (cm)",
      birthYear: "Gimimo metai",
      gender: "Lytis",
      targetWeight: "Tikslinis svoris (kg)",
      unset: "Nenurodyta",
      missing: (fields) =>
        `Vis dar nežinoma: ${fields}. Kas remiasi šiais dydžiais, tai pasakys, o ne spės.`,
      weightNote:
        "Kūno svorio čia nėra sąmoningai: tai matavimas su data, įrašomas progreso puslapyje, ir kiekvienas skaičiavimas naudoja naujausią.",
      save: "Išsaugoti",
      saved: "Išsaugota.",
      invalid:
        "Patikrink reikšmes: ūgis 120-230 cm, gimimo metai per pastarąjį šimtmetį, tikslinis svoris 30-300 kg.",
    },
  };
}

function numberOrDash(value: number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function dataGapAction(
  gap: string,
  lang: Lang,
): { label: string; to: "/training" | "/readiness" | "/progress" | "/nutrition" } {
  const isEnglish = baseLang(lang) === "en";
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

function memoryTypeLabel(type: UserMemoryTransparencyItem["type"], lang: Lang): string {
  const english = baseLang(lang) === "en";
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

function memorySourceLabel(source: UserMemorySource, lang: Lang): string {
  const english = baseLang(lang) === "en";
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
    <div className="flex items-end justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="shrink-0 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function AthleteModelPage() {
  const { lang, t } = useI18n();
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
  const loadBody = useServerFn(getProfileBody);
  const persistBody = useServerFn(saveProfileBody);
  const [bodyLoading, setBodyLoading] = useState(true);
  const [savingBody, setSavingBody] = useState(false);
  const [bodyForm, setBodyForm] = useState({
    heightCm: "",
    birthYear: "",
    gender: "",
    targetWeightKg: "",
  });

  useEffect(() => {
    let active = true;
    setBodyLoading(true);
    void loadBody()
      .then((stored) => {
        if (!active) return;
        setBodyForm({
          heightCm: stored.heightCm === null ? "" : String(stored.heightCm),
          birthYear: stored.birthYear === null ? "" : String(stored.birthYear),
          gender: stored.gender ?? "",
          targetWeightKg: stored.targetWeightKg === null ? "" : String(stored.targetWeightKg),
        });
      })
      .catch(() => {
        // Leaves the fields blank; the athlete can still fill and save them.
      })
      .finally(() => {
        if (active) setBodyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadBody]);

  // A blank field means "not recorded", which is a value the model handles.
  const blankToNull = (value: string): number | null =>
    value.trim() === "" ? null : Number(value);

  const missingBodyFacts = [
    bodyForm.heightCm.trim() === "" ? copy.bodyFacts.height : null,
    bodyForm.birthYear.trim() === "" ? copy.bodyFacts.birthYear : null,
    bodyForm.gender === "" ? copy.bodyFacts.gender : null,
  ].filter((label): label is string => label !== null);

  const saveBody = async () => {
    setSavingBody(true);
    try {
      const parsed = ProfileBodySchema.safeParse({
        heightCm: blankToNull(bodyForm.heightCm),
        birthYear: blankToNull(bodyForm.birthYear),
        gender: bodyForm.gender === "" ? null : bodyForm.gender,
        targetWeightKg: blankToNull(bodyForm.targetWeightKg),
      });
      if (!parsed.success) {
        toast.error(copy.bodyFacts.invalid);
        return;
      }
      await persistBody({ data: parsed.data });
      toast.success(copy.bodyFacts.saved);
    } catch (error) {
      toast.error(errorMessage(error, copy.bodyFacts.invalid));
    } finally {
      setSavingBody(false);
    }
  };

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
  const locale = formatLocale(lang);

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

  const english = baseLang(lang) === "en";
  const ui = english
    ? {
        trust: "MODEL TRANSPARENCY",
        knows: "What GYMS.LIFE currently knows",
        knowsSub: "Only active facts and patterns that the system is allowed to use.",
        needs: "What would make the model stronger",
        inspect: "Inspect deterministic measurements",
        inspectSub: "Aggregated training, recovery, body and nutrition facts behind the model.",
        rhythm: "Inspect training rhythm",
        controls: "Evidence & controls",
        modelState: "Model state",
        snapshot: "Last deterministic snapshot",
      }
    : {
        trust: "MODELIO SKAIDRUMAS",
        knows: "Ką GYMS.LIFE šiuo metu žino",
        knowsSub: "Tik aktyvūs faktai ir dėsningumai, kuriuos sistemai leidžiama naudoti.",
        needs: "Kas sustiprintų modelį",
        inspect: "Peržiūrėti deterministinius rodiklius",
        inspectSub:
          "Agreguoti treniruočių, atsistatymo, kūno ir mitybos faktai, kuriais remiasi modelis.",
        rhythm: "Peržiūrėti treniruočių ritmą",
        controls: "Įrodymai ir valdymas",
        modelState: "Modelio būsena",
        snapshot: "Paskutinė deterministinė būsena",
      };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050706] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(65% 110% at 0% 0%, rgba(16,185,129,.10), transparent 62%)",
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
              {ui.trust}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500">
              {copy.description}
            </p>
          </div>
          <Button
            onClick={() => void load()}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="self-start text-neutral-500 hover:text-white lg:self-auto"
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
          <div className="relative mt-7 flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin text-emerald-400" /> {copy.updating}
          </div>
        ) : null}

        {state ? (
          <div className="relative mt-7 grid gap-5 border-t border-white/[0.06] pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                  {ui.modelState}
                </p>
                <p className="mt-1 text-lg font-medium text-white">
                  {copy.quality[state.dataQuality.level]}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {state.dataQuality.evidenceCount} {copy.evidence} · {copy.transparent}
                </p>
              </div>
            </div>
            <div className="font-mono text-[10px] text-neutral-600">
              {model?.snapshot
                ? `${ui.snapshot}: ${new Date(model.snapshot.computedAt).toLocaleString(locale)}`
                : copy.unavailable}
            </div>
          </div>
        ) : null}
      </section>

      {/* The stable body facts. Until now their only entry point was the
          onboarding form, so an athlete who signed up before it started saving
          them had no way to tell the app how tall they are. */}
      <section className="rounded-[1.75rem] border border-border bg-foreground/[0.02] p-5 sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 light:text-emerald-700">
            <Ruler className="size-4" /> {copy.bodyFacts.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {copy.bodyFacts.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {copy.bodyFacts.sub}
          </p>
        </div>

        {bodyLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-emerald-400 light:text-emerald-700" />{" "}
            {copy.memory.loading}
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {copy.bodyFacts.height}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={bodyForm.heightCm}
                  onChange={(event) =>
                    setBodyForm((current) => ({ ...current, heightCm: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-foreground"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {copy.bodyFacts.birthYear}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={bodyForm.birthYear}
                  onChange={(event) =>
                    setBodyForm((current) => ({ ...current, birthYear: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-foreground"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {copy.bodyFacts.gender}
                </span>
                <select
                  value={bodyForm.gender}
                  onChange={(event) =>
                    setBodyForm((current) => ({ ...current, gender: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-foreground"
                >
                  <option value="">{copy.bodyFacts.unset}</option>
                  <option value="male">{t("ob.g.male")}</option>
                  <option value="female">{t("ob.g.female")}</option>
                  <option value="other">{t("ob.g.other")}</option>
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {copy.bodyFacts.targetWeight}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={bodyForm.targetWeightKg}
                  onChange={(event) =>
                    setBodyForm((current) => ({ ...current, targetWeightKg: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-border bg-surface-2 px-3 text-foreground"
                />
              </label>
            </div>

            {/* Says plainly what stays unknown, rather than letting a blank
                field quietly become an assumed body downstream. */}
            {missingBodyFacts.length > 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-amber-400 light:text-amber-700">
                {copy.bodyFacts.missing(missingBodyFacts.join(" · "))}
              </p>
            ) : null}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {copy.bodyFacts.weightNote}
            </p>

            <Button
              type="button"
              onClick={saveBody}
              disabled={savingBody}
              className="mt-4 rounded-full"
            >
              {savingBody ? <Loader2 className="size-4 animate-spin" /> : null}
              {copy.bodyFacts.save}
            </Button>
          </>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-border bg-foreground/[0.02] p-5 sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 light:text-emerald-700">
            <Brain className="size-4" /> {copy.memory.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{ui.knows}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ui.knowsSub}</p>
        </div>

        {memoryLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-emerald-400 light:text-emerald-700" />{" "}
            {copy.memory.loading}
          </div>
        ) : memories.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{copy.memory.empty}</p>
        ) : (
          <div className="mt-5 divide-y divide-white/[0.06]">
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
                <details key={memory.id} className="group py-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400 light:text-emerald-700">
                            {memoryTypeLabel(memory.type, lang)}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            {copy.memory.evidenceStateLabel[memory.evidenceState]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                          {displayedContent}
                        </p>
                      </div>
                      <span className="mt-1 shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground group-open:text-muted-foreground">
                        {ui.controls}
                      </span>
                    </div>
                  </summary>

                  <div className="mt-4 rounded-2xl border border-border bg-black/20 p-4">
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {evidenceSummary ?? copy.memory.evidence(memory.evidenceCount)}
                    </p>
                    <dl className="mt-4 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">{copy.memory.source}</dt>
                        <dd className="mt-0.5 text-foreground">
                          {memorySourceLabel(memory.source, lang)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.memory.evidenceState}</dt>
                        <dd className="mt-0.5 text-foreground">
                          {copy.memory.evidenceStateLabel[memory.evidenceState]}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{copy.memory.lastConfirmed}</dt>
                        <dd className="mt-0.5 text-foreground">
                          {new Date(memory.lastConfirmedAt).toLocaleDateString(locale)}
                        </dd>
                      </div>
                      {memory.expiresAt ? (
                        <div>
                          <dt className="text-muted-foreground">{copy.memory.expires}</dt>
                          <dd className="mt-0.5 text-foreground">
                            {new Date(memory.expiresAt).toLocaleString(locale)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
                            <Pencil /> {copy.memory.correct}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            disabled={pendingMemoryAction !== null}
                            onClick={() => void changeMemory(memory.id, "incorrect")}
                          >
                            {incorrectPending ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <ThumbsDown />
                            )}
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
                      <div className="mt-4 border-t border-border pt-4">
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
                          className="mt-3 border-border bg-foreground/[0.02]"
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
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      {state ? (
        <section className="rounded-[1.75rem] border border-border bg-foreground/[0.02] p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {ui.needs}
          </p>
          {state.dataGaps.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
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
            <p className="mt-2 text-sm text-muted-foreground">{copy.noGaps}</p>
          )}
        </section>
      ) : null}

      {state ? (
        <details className="rounded-[1.75rem] border border-border bg-foreground/[0.02]">
          <summary className="cursor-pointer list-none px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-foreground">{ui.inspect}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ui.inspectSub}</p>
          </summary>
          <div className="grid border-t border-border md:grid-cols-2">
            <div className="p-5 sm:p-6 md:border-r md:border-border">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Dumbbell className="size-4 text-emerald-400 light:text-emerald-700" />{" "}
                {copy.training}
              </h3>
              <div className="mt-3">
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
            <div className="grid sm:grid-cols-3 md:grid-cols-1">
              <div className="p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HeartPulse className="size-4 text-emerald-400 light:text-emerald-700" />{" "}
                  {copy.recovery}
                </h3>
                <div className="mt-3">
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
              <div className="border-t border-border p-5 sm:p-6 sm:border-l sm:border-t-0 md:border-l-0 md:border-t">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Scale className="size-4 text-emerald-400 light:text-emerald-700" /> {copy.body}
                </h3>
                <div className="mt-3">
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
              <div className="border-t border-border p-5 sm:p-6 sm:border-l sm:border-t-0 md:border-l-0 md:border-t">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Apple className="size-4 text-emerald-400 light:text-emerald-700" />{" "}
                  {copy.nutrition}
                </h3>
                <div className="mt-3">
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
            </div>
          </div>
        </details>
      ) : null}

      <details className="rounded-[1.75rem] border border-border bg-foreground/[0.02]">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground sm:px-6">
          {ui.rhythm}
        </summary>
        <div className="border-t border-border p-4 sm:p-5">
          <TrainingRhythmCard />
        </div>
      </details>
    </div>
  );
}
