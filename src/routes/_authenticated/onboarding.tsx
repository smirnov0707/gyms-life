import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Zap,
  ListChecks,
  Timer,
  CheckCircle2,
  Play,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { generatePlan } from "@/lib/plan.functions";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PlanData } from "@/lib/plan-types";
import { parseStoredTrainingPlan } from "@/lib/training-plan.schema";
import { BodyCompositionScanner } from "@/components/BodyCompositionScanner";
import { aiErrorMessage } from "@/lib/ai-error";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Tikslo anketa — GYMS.LIFE" },
      {
        name: "description",
        content: "Atsakyk į klausimus apie tikslą, patirtį ir įrangą — GYMS.LIFE sugeneruos planą.",
      },
      { property: "og:title", content: "Tikslo anketa — GYMS.LIFE" },
      { property: "og:description", content: "Individualaus treniruočių plano anketa." },
    ],
  }),
  component: Onboarding,
});

type Choice = { value: string; key: TKey };

const goals: Choice[] = [
  { value: "lose_fat", key: "ob.goal.lose" },
  { value: "build_muscle", key: "ob.goal.muscle" },
  { value: "strength", key: "ob.goal.strength" },
  { value: "endurance", key: "ob.goal.endurance" },
];
const experiences: Choice[] = [
  { value: "beginner", key: "ob.exp.beginner" },
  { value: "intermediate", key: "ob.exp.intermediate" },
  { value: "advanced", key: "ob.exp.advanced" },
];
const locations: Choice[] = [
  { value: "gym", key: "ob.loc.gym" },
  { value: "home", key: "ob.loc.home" },
  { value: "both", key: "ob.loc.both" },
];
const equipmentOptions: Choice[] = [
  { value: "bodyweight", key: "eq.bodyweight" },
  { value: "dumbbell", key: "eq.dumbbell" },
  { value: "barbell", key: "eq.barbell" },
  { value: "kettlebell", key: "eq.kettlebell" },
  { value: "machine", key: "eq.machine" },
  { value: "cable", key: "eq.cable" },
  { value: "bands", key: "eq.bands" },
  { value: "pullup_bar", key: "eq.pullup" },
];
const genders: Choice[] = [
  { value: "male", key: "ob.g.male" },
  { value: "female", key: "ob.g.female" },
  { value: "other", key: "ob.g.other" },
];

type StepId =
  | "scan"
  | "goal"
  | "experience"
  | "place"
  | "schedule"
  | "body"
  | "limits"
  | "quickTrain"
  | "quickBody";

const QUICK_STEPS: StepId[] = ["scan", "goal", "quickTrain", "quickBody"];
const FULL_STEPS: StepId[] = ["scan", "goal", "experience", "place", "schedule", "body", "limits"];

const SCAN_COPY = {
  lt: {
    title: "1. Nuskenuok kūną (nebūtina)",
    sub: "Pradėk nuo 3D kūno kompozicijos skenerio — riebalų %, apimtys ir svoris bus automatiškai perkelti į anketą, o tikslas pasiūlytas pagal realius duomenis.",
    skip: "Praleisti ir rinktis tikslą",
    done: "Duomenys perkelti į anketą",
    recommend: "Rekomenduojamas tikslas pagal skenavimą",
  },
  en: {
    title: "1. Scan your body (optional)",
    sub: "Start with the 3D body composition scan — body-fat %, circumferences and weight are copied into the form and the goal is recommended from real data.",
    skip: "Skip and pick a goal",
    done: "Data copied into the form",
    recommend: "Recommended goal from your scan",
  },
} as const;

function recommendGoal(bodyFat: number | null, sex: string): string {
  if (bodyFat == null) return "build_muscle";
  const high = sex === "female" ? 30 : 22;
  const low = sex === "female" ? 22 : 14;
  if (bodyFat >= high) return "lose_fat";
  if (bodyFat <= low) return "strength";
  return "build_muscle";
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left text-sm font-semibold transition-all",
        active
          ? "border-primary bg-primary/12 text-primary glow-ring"
          : "border-border bg-surface text-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const run = useServerFn(generatePlan);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<PlanData | null>(null);

  const [goal, setGoal] = useState("build_muscle");
  const [experience, setExperience] = useState("beginner");
  const [location, setLocation] = useState("gym");
  const [equipment, setEquipment] = useState<string[]>(["bodyweight"]);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("");
  const [limits, setLimits] = useState("");
  const [scanBodyFat, setScanBodyFat] = useState<number | null>(null);
  const [recommended, setRecommended] = useState<string | null>(null);
  const sc = SCAN_COPY[lang === "lt" ? "lt" : "en"];

  const stepIds = mode === "quick" ? QUICK_STEPS : FULL_STEPS;
  const steps = stepIds.length;
  const current = stepIds[Math.min(step, steps - 1)]!;

  // 2-minute budget indicator for quick mode
  useEffect(() => {
    if (result || busy) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [result, busy]);

  const remaining = Math.max(0, 120 - elapsed);
  const mmss = `${String(Math.floor(remaining / 60)).padStart(1, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  const toggleEquip = (v: string) =>
    setEquipment((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await run({
        data: {
          goal,
          experience,
          location,
          equipment,
          daysPerWeek: days,
          sessionMinutes: minutes,
          age: age ? Number(age) : null,
          gender,
          heightCm: height ? Number(height) : null,
          weightKg: weight ? Number(weight) : null,
          targetWeightKg: target ? Number(target) : null,
          limitations: limits || null,
          lang,
        },
      });
      if (res.planId) {
        const { data } = await supabase
          .from("plans")
          .select("data")
          .eq("id", res.planId)
          .maybeSingle();
        const planData = data ? parseStoredTrainingPlan(data.data) : null;
        if (planData) setResult(planData);
        else navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(aiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <Loader2 className="mx-auto size-10 animate-spin text-primary" />
          <h2 className="mt-6 text-3xl">{t("ob.generating")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">GYMS.LIFE</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="panel relative overflow-hidden p-7 md:p-9">
          <div className="grain-hero pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <CheckCircle2 className="size-4" /> {t("qo.ready")}
            </p>
            <h1 className="headline-xl mt-3 text-5xl md:text-6xl">{result.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {result.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="hard-shadow rounded-none px-8 font-bold">
                <Link to="/workout/$day" params={{ day: "1" }}>
                  <Play className="mr-1 size-4" /> {t("qo.startNow")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none px-8 font-bold">
                <Link to="/app">{t("qo.open")}</Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setStep(0);
                  setElapsed(0);
                }}
              >
                {t("qo.again")}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {result.days.map((d, i) => (
            <div key={d.day} className="panel lift p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("plan.day")} {d.day}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> {d.estimated_minutes} {t("plan.min")}
                </span>
              </div>
              <h2 className="mt-1 text-2xl">{d.title}</h2>
              <p className="text-sm text-primary">{d.focus}</p>
              <div className="mt-3 grid gap-1.5">
                {d.exercises.map((e) => (
                  <div
                    key={e.slug}
                    className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span>{e.name}</span>
                    <span className="text-display text-lg text-primary">
                      {e.sets}×{e.reps}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 h-1 rounded-full bg-primary/25"
                style={{ width: `${Math.min(100, (i + 1) * (100 / result.days.length))}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-xs font-bold">
          {(
            [
              { v: "quick", key: "qo.quick", icon: Zap },
              { v: "full", key: "qo.full", icon: ListChecks },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => {
                setMode(m.v);
                setStep(0);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 uppercase tracking-wide transition-colors",
                mode === m.v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <m.icon className="size-3.5" />
              {t(m.key)}
            </button>
          ))}
        </div>
        {mode === "quick" && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest",
              remaining > 20 ? "text-muted-foreground" : "text-accent",
            )}
          >
            <Timer className="size-3.5" /> {mmss} {t("qo.left")}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <span>
          {t("ob.step")} {step + 1} {t("ob.of")} {steps}
        </span>
        <Sparkles className="size-4 text-primary" />
      </div>
      <div className="mt-3 flex gap-1.5">
        {stepIds.map((id, i) => (
          <span
            key={id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-surface-2",
            )}
          />
        ))}
      </div>

      <h1 className="headline-xl mt-8 text-5xl">{t("ob.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("ob.sub")}</p>

      <div className="mt-8 panel p-6">
        {current === "scan" && (
          <>
            <h2 className="text-2xl">{sc.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{sc.sub}</p>
            <div className="mt-4">
              <BodyCompositionScanner
                onResult={(r) => {
                  setScanBodyFat(r.bodyFat);
                  setHeight(String(Math.round(r.heightCm)));
                  if (r.weightKg) setWeight(String(Math.round(r.weightKg)));
                  if (r.age) setAge(String(r.age));
                  if (r.sex === "male" || r.sex === "female") setGender(r.sex);
                  const rec = recommendGoal(r.bodyFat, r.sex);
                  setRecommended(rec);
                  setGoal(rec);
                  toast.success(sc.done);
                }}
              />
            </div>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => setStep((s) => s + 1)}>
              {sc.skip} <ArrowRight className="ml-1 size-4" />
            </Button>
          </>
        )}

        {current === "goal" && (
          <>
            <h2 className="text-2xl">{t("qo.q1")}</h2>
            {recommended && (
              <p className="mt-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
                {sc.recommend}: {t(goals.find((g) => g.value === recommended)!.key)}
                {scanBodyFat != null ? ` · ${scanBodyFat}%` : ""}
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {goals.map((g) => (
                <OptionButton
                  key={g.value}
                  active={goal === g.value}
                  onClick={() => setGoal(g.value)}
                >
                  {t(g.key)}
                </OptionButton>
              ))}
            </div>
            {mode === "quick" && (
              <>
                <h2 className="mt-8 text-2xl">{t("ob.q.experience")}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {experiences.map((g) => (
                    <OptionButton
                      key={g.value}
                      active={experience === g.value}
                      onClick={() => setExperience(g.value)}
                    >
                      <span className="block text-center text-xs">{t(g.key)}</span>
                    </OptionButton>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {current === "experience" && (
          <>
            <h2 className="text-2xl">{t("ob.q.experience")}</h2>
            <div className="mt-4 grid gap-3">
              {experiences.map((g) => (
                <OptionButton
                  key={g.value}
                  active={experience === g.value}
                  onClick={() => setExperience(g.value)}
                >
                  {t(g.key)}
                </OptionButton>
              ))}
            </div>
          </>
        )}

        {(current === "place" || current === "quickTrain") && (
          <>
            <h2 className="text-2xl">{mode === "quick" ? t("qo.q2") : t("ob.q.location")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {locations.map((g) => (
                <OptionButton
                  key={g.value}
                  active={location === g.value}
                  onClick={() => setLocation(g.value)}
                >
                  {t(g.key)}
                </OptionButton>
              ))}
            </div>

            {current === "quickTrain" ? (
              <>
                <h2 className="mt-8 text-2xl">{t("ob.q.days")}</h2>
                <div className="mt-4 grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <OptionButton key={d} active={days === d} onClick={() => setDays(d)}>
                      <span className="block text-center text-lg">{d}</span>
                    </OptionButton>
                  ))}
                </div>
                <h2 className="mt-8 text-2xl">{t("ob.q.minutes")}</h2>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[30, 45, 60, 90].map((m) => (
                    <OptionButton key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                      <span className="block text-center text-lg">{m}</span>
                    </OptionButton>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-8 text-2xl">{t("ob.q.equipment")}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {equipmentOptions.map((g) => (
                    <OptionButton
                      key={g.value}
                      active={equipment.includes(g.value)}
                      onClick={() => toggleEquip(g.value)}
                    >
                      {t(g.key)}
                    </OptionButton>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {current === "schedule" && (
          <>
            <h2 className="text-2xl">{t("ob.q.days")}</h2>
            <div className="mt-4 grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <OptionButton key={d} active={days === d} onClick={() => setDays(d)}>
                  <span className="block text-center text-lg">{d}</span>
                </OptionButton>
              ))}
            </div>
            <h2 className="mt-8 text-2xl">{t("ob.q.minutes")}</h2>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[30, 45, 60, 90].map((m) => (
                <OptionButton key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                  <span className="block text-center text-lg">{m}</span>
                </OptionButton>
              ))}
            </div>
          </>
        )}

        {(current === "body" || current === "quickBody") && (
          <>
            <h2 className="text-2xl">{mode === "quick" ? t("qo.q3") : t("ob.q.body")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="age">{t("ob.f.age")}</Label>
                <Input
                  id="age"
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("ob.f.gender")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {genders.map((g) => (
                    <OptionButton
                      key={g.value}
                      active={gender === g.value}
                      onClick={() => setGender(g.value)}
                    >
                      <span className="block text-center text-xs">{t(g.key)}</span>
                    </OptionButton>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="h">{t("ob.f.height")}</Label>
                <Input
                  id="h"
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="w">{t("ob.f.weight")}</Label>
                <Input
                  id="w"
                  inputMode="numeric"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tw">{t("ob.f.target")}</Label>
                <Input
                  id="tw"
                  inputMode="numeric"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
            </div>
            {current === "quickBody" && (
              <>
                <h2 className="mt-8 text-2xl">{t("ob.q.limits")}</h2>
                <Textarea
                  className="mt-3 min-h-24"
                  placeholder={t("ob.limits.ph")}
                  value={limits}
                  onChange={(e) => setLimits(e.target.value)}
                />
              </>
            )}
          </>
        )}

        {current === "limits" && (
          <>
            <h2 className="text-2xl">{t("ob.q.limits")}</h2>
            <Textarea
              className="mt-4 min-h-32"
              placeholder={t("ob.limits.ph")}
              value={limits}
              onChange={(e) => setLimits(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1 size-4" /> {t("ob.back")}
        </Button>
        {step < steps - 1 ? (
          <Button className="rounded-full px-6 font-bold" onClick={() => setStep((s) => s + 1)}>
            {t("ob.next")} <ArrowRight className="ml-1 size-4" />
          </Button>
        ) : (
          <Button className="rounded-full px-6 font-bold glow-ring" onClick={submit}>
            <Sparkles className="mr-1 size-4" /> {t("ob.generate")}
          </Button>
        )}
      </div>
    </div>
  );
}
