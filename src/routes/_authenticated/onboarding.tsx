import { useQueryClient } from "@tanstack/react-query";
import { refreshCoreData } from "@/lib/core-cache";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Zap,
  ListChecks,
  Timer,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { generatePlan } from "@/lib/plan.functions";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TrainingPlanData } from "@/lib/training-plan.schema";
import { TrainingIntakeSchema, optionalFormNumber } from "@/lib/training-intake.schema";
import { aiErrorMessage } from "@/lib/ai-error";
import { ProgramActivationActions } from "@/components/ProgramActivationActions";

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
  "goal" | "experience" | "place" | "schedule" | "body" | "limits" | "quickTrain" | "quickBody";

const QUICK_STEPS: StepId[] = ["goal", "quickTrain", "quickBody"];
const FULL_STEPS: StepId[] = ["goal", "experience", "place", "schedule", "body", "limits"];

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
      aria-pressed={active}
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
  const run = useServerFn(generatePlan);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const initializedUser = useRef<string | null>(null);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TrainingPlanData | null>(null);
  const [generatedPlanId, setGeneratedPlanId] = useState<string | null>(null);

  const [goal, setGoal] = useState("build_muscle");
  const [experience, setExperience] = useState("beginner");
  const [location, setLocation] = useState("gym");
  const [equipment, setEquipment] = useState<string[]>(["bodyweight"]);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("");
  const [limits, setLimits] = useState("");
  const submitLock = useRef(false);
  const profileQuery = useQuery({
    queryKey: ["training-intake", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "goal,experience,location,equipment,days_per_week,session_minutes,birth_year,gender,height_cm,weight_kg,target_weight_kg,limitations",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw new Error("Training profile unavailable");
      return data;
    },
  });
  useEffect(() => {
    if (!user || profileQuery.data === undefined || initializedUser.current === user.id) return;
    const p = profileQuery.data;
    if (p) {
      if (p.goal)
        setGoal(p.goal === "lose" ? "lose_fat" : p.goal === "muscle" ? "build_muscle" : p.goal);
      if (p.experience) setExperience(p.experience);
      if (p.location) setLocation(p.location);
      if (p.equipment)
        setEquipment(p.equipment.map((value) => (value === "band" ? "bands" : value)));
      if (p.days_per_week != null) setDays(p.days_per_week);
      if (p.session_minutes != null) setMinutes(p.session_minutes);
      if (p.birth_year != null) setAge(String(new Date().getUTCFullYear() - p.birth_year));
      if (p.gender) setGender(p.gender);
      if (p.height_cm != null) setHeight(String(p.height_cm));
      if (p.weight_kg != null) setWeight(String(p.weight_kg));
      if (p.target_weight_kg != null) setTarget(String(p.target_weight_kg));
      setLimits(p.limitations ?? "");
    }
    initializedUser.current = user.id;
  }, [user, profileQuery.data]);

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
    if (submitLock.current || profileQuery.isPending || profileQuery.isError) return;
    submitLock.current = true;
    setBusy(true);
    try {
      const intake = TrainingIntakeSchema.safeParse({
        goal,
        experience,
        location,
        equipment,
        daysPerWeek: days,
        sessionMinutes: minutes,
        age: optionalFormNumber(age),
        gender: gender || null,
        heightCm: optionalFormNumber(height),
        weightKg: optionalFormNumber(weight),
        targetWeightKg: optionalFormNumber(target),
        limitations: limits || null,
        lang,
      });
      if (!intake.success) {
        toast.error(
          lang === "lt"
            ? "Patikrink skaičius ir pasirinkimus anketoje. Svorį galima įvesti su kableliu."
            : "Check the numbers and choices in the form. Decimal commas are accepted.",
        );
        return;
      }
      const res = await run({ data: intake.data });
      if (!res.planId) throw new Error("Generated plan could not be saved.");
      setGeneratedPlanId(res.planId);
      setResult(res.plan);
      await refreshCoreData(queryClient, "training");
    } catch (err) {
      toast.error(aiErrorMessage(err, t));
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  if (profileQuery.isPending) return <p role="status">{t("common.loading")}</p>;
  if (profileQuery.isError)
    return (
      <section role="alert" className="panel p-6">
        <p>
          {lang === "lt"
            ? "Nepavyko įkelti tavo profilio. Esami pasirinkimai nebus pakeisti."
            : "Could not load your profile. Your existing choices will not be overwritten."}
        </p>
        <Button onClick={() => void profileQuery.refetch()}>
          {lang === "lt" ? "Bandyti dar kartą" : "Retry"}
        </Button>
      </section>
    );
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
              {generatedPlanId && <ProgramActivationActions planId={generatedPlanId} lang={lang} />}
              <Button asChild size="lg" variant="outline" className="rounded-none px-8 font-bold">
                <Link to="/app">{t("qo.open")}</Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setGeneratedPlanId(null);
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
        {current === "goal" && (
          <>
            <h2 className="text-2xl">{t("qo.q1")}</h2>
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
            ) : null}
            {
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
            }
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
