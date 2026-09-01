import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Timer, Dumbbell, ChevronRight, Flame, Wind } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { buildRequestedWorkout, type RequestedWorkout } from "@/lib/workout-request.functions";

type Labels = {
  title: string;
  subtitle: string;
  placeholder: string;
  minutes: string;
  generate: string;
  generating: string;
  error: string;
  warmup: string;
  main: string;
  cooldown: string;
  tips: string;
  sets: string;
  rest: string;
  open: string;
  signIn: string;
  examples: string[];
};

const L: Record<string, Labels> = {
  lt: {
    title: "Parašyk, ką nori treniruoti",
    subtitle: "Treneris sudarys pratimų sąrašą su serijomis, kartojimais, poilsiu ir trukme.",
    placeholder: "Pvz.: noriu sustiprinti nugarą ir pečius, turiu tik hantelius, 40 min",
    minutes: "Trukmė (min)",
    generate: "Sugeneruoti treniruotę",
    generating: "Kuriama...",
    error: "Nepavyko sugeneruoti. Bandyk dar kartą.",
    warmup: "Apšilimas",
    main: "Pagrindinė dalis",
    cooldown: "Atsipalaidavimas",
    tips: "Patarimai",
    sets: "serijos",
    rest: "poilsis",
    open: "Žiūrėti video",
    signIn: "Prisijunk, kad Treneris sudarytų treniruotę pagal tavo profilį",
    examples: ["Presas ir liemuo namie, 20 min", "Kojos salėje, jėgos diena", "Viršus su gumomis, be šuolių"],
  },
  en: {
    title: "Tell us what you want to train",
    subtitle: "Coach builds an exercise list with sets, reps, rest and duration.",
    placeholder: "e.g. strengthen back and shoulders, dumbbells only, 40 min",
    minutes: "Duration (min)",
    generate: "Generate workout",
    generating: "Building...",
    error: "Could not generate. Try again.",
    warmup: "Warm-up",
    main: "Main work",
    cooldown: "Cool-down",
    tips: "Tips",
    sets: "sets",
    rest: "rest",
    open: "Watch video",
    signIn: "Sign in so the Coach can build a workout from your profile",
    examples: ["Abs and core at home, 20 min", "Leg day at the gym, strength", "Upper body with bands, no jumping"],
  },
};

export function WorkoutRequestBuilder() {
  const { lang } = useI18n();
  const l = L[lang] ?? L["en"]!;
  const { user } = useAuth();
  const build = useServerFn(buildRequestedWorkout);
  const [request, setRequest] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RequestedWorkout | null>(null);

  const generate = async (text?: string) => {
    const q = (text ?? request).trim();
    if (q.length < 3) return;
    setBusy(true);
    try {
      const r = await build({ data: { request: q, lang: lang === "lt" ? "lt" : "en", minutes } });
      setResult(r);
    } catch {
      toast.error(l.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-4 rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-bold leading-tight">{l.title}</h2>
          <p className="text-sm text-muted-foreground">{l.subtitle}</p>
        </div>
      </div>

      {!user ? (
        <Link
          to="/auth"
          className="press mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Sparkles className="size-4" /> {l.signIn}
        </Link>
      ) : (
      <>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={2}
          placeholder={l.placeholder}
          aria-label={l.title}
          className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted-foreground">
            <span className="mb-1 block">{l.minutes}</span>
            <input
              type="number"
              min={10}
              max={150}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 45)}
              className="w-20 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={() => void generate()}
            disabled={busy || request.trim().length < 3}
            className="press flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}
            {busy ? l.generating : l.generate}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {l.examples.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setRequest(ex);
              void generate(ex);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-surface-2"
          >
            {ex}
          </button>
        ))}
      </div>

      </>
      )}

      {result && (
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="text-xl font-bold">{result.title}</h3>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Timer className="size-3.5" /> ~{result.total_minutes} min · {result.blocks.length} ×
            </p>
          </div>

          {result.warmup.length > 0 && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Flame className="size-3.5 text-accent" /> {l.warmup}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {result.warmup.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{l.main}</p>
            <ol className="mt-2 space-y-2">
              {result.blocks.map((b, i) => (
                <li
                  key={b.slug || i}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.sets} {l.sets} × {b.reps} · {l.rest} {b.rest_seconds}s
                      {b.muscle ? ` · ${b.muscle}` : ""}
                    </p>
                    {b.note && <p className="mt-0.5 text-xs text-muted-foreground">{b.note}</p>}
                  </div>
                  {b.hasPage && (
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: b.slug }}
                      className="press flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-2"
                    >
                      {l.open} <ChevronRight className="size-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {result.cooldown.length > 0 && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Wind className="size-3.5 text-primary" /> {l.cooldown}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {result.cooldown.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {result.tips.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{l.tips}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {result.tips.map((tp, i) => (
                  <li key={i}>{tp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
