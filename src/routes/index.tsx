import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Flame,
  Loader2,
  PlayCircle,
  Quote,
  Check,
  X,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateMotivation } from "@/lib/motivation.functions";
import { HERO_IMAGES, heroAlt, nextHeroIndex } from "@/lib/hero-images";
import { LANDING_QUOTES, nextQuoteIndex } from "@/lib/landing-quotes";
import screenApp from "@/assets/screens/app.png";
import screenWorkout from "@/assets/screens/workout.png";
import screenExercises from "@/assets/screens/exercises.png";
import screenCoach from "@/assets/screens/coach.png";
import screenProgress from "@/assets/screens/progress.png";
import screenNutrition from "@/assets/screens/nutrition.png";

import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Logo, LangSwitch, headerName } from "@/components/AppShell";
import { GlowCard } from "@/components/GlowCard";
import { Reveal } from "@/components/Reveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { tactileClick } from "@/lib/tactile";
import { AppShell } from "@/components/AppShell";
import { Overview } from "@/components/Overview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GYMS.LIFE — AI Personal Trainer & Custom Workout Plans" },
      {
        name: "description",
        content:
          "Create personalized workout and nutrition plans in minutes. AI trainer, video demos, set tracking, body composition scan, and progress analytics.",
      },
      { property: "og:title", content: "GYMS.LIFE — AI Personal Trainer & Custom Workout Plans" },
      {
        property: "og:description",
        content:
          "Create personalized workout and nutrition plans in minutes. AI trainer, video demos, set tracking, body composition scan, and progress analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const SCREENS: { src: string; t: TKey; d: TKey }[] = [
  { src: screenApp, t: "l2.show.app.t", d: "l2.show.app.d" },
  { src: screenWorkout, t: "l2.show.workout.t", d: "l2.show.workout.d" },
  { src: screenExercises, t: "l2.show.exercises.t", d: "l2.show.exercises.d" },
  { src: screenCoach, t: "l2.show.coach.t", d: "l2.show.coach.d" },
  { src: screenProgress, t: "l2.show.progress.t", d: "l2.show.progress.d" },
  { src: screenNutrition, t: "l2.show.nutrition.t", d: "l2.show.nutrition.d" },
];

const STEPS: { t: TKey; d: TKey }[] = [
  { t: "l2.s1.t", d: "l2.s1.d" },
  { t: "l2.s2.t", d: "l2.s2.d" },
  { t: "l2.s3.t", d: "l2.s3.d" },
  { t: "l2.s4.t", d: "l2.s4.d" },
  { t: "l2.s5.t", d: "l2.s5.d" },
];

const AUDIENCE: { t: TKey; d: TKey }[] = [
  { t: "l2.who1.t", d: "l2.who1.d" },
  { t: "l2.who2.t", d: "l2.who2.d" },
  { t: "l2.who3.t", d: "l2.who3.d" },
  { t: "l2.who4.t", d: "l2.who4.d" },
  { t: "l3.who5.t", d: "l3.who5.d" },
];

const FAQ: { q: TKey; a: TKey }[] = [
  { q: "l2.faq.q1", a: "l2.faq.a1" },
  { q: "l2.faq.q2", a: "l2.faq.a2" },
  { q: "l2.faq.q3", a: "l2.faq.a3" },
  { q: "l2.faq.q4", a: "l2.faq.a4" },
  { q: "l2.faq.q5", a: "l2.faq.a5" },
  { q: "l2.faq.q6", a: "l2.faq.a6" },
  { q: "l3.faq.q7", a: "l3.faq.a7" },
  { q: "l3.faq.q8", a: "l3.faq.a8" },
  { q: "l3.faq.q9", a: "l3.faq.a9" },
  { q: "l3.faq.q10", a: "l3.faq.a10" },
  { q: "l3.faq.q11", a: "l3.faq.a11" },
  { q: "l3.faq.q12", a: "l3.faq.a12" },
];

/** Every feature the signed-in app actually ships, in the app's own words. */
const INSIDE: { t: TKey; d: TKey }[] = [
  { t: "nav.dashboard", d: "l2.show.app.d" },
  { t: "rd.title", d: "rd.sub" },
  { t: "nav.exercises", d: "l2.show.exercises.d" },
  { t: "nav.ar", d: "ar.sub" },
  { t: "nav.meal", d: "mp.sub" },
  { t: "nav.nutrition", d: "nut.sub" },
  { t: "nav.supplements", d: "supp.sub" },
  { t: "nav.progress", d: "l2.show.progress.d" },
  { t: "nav.coach", d: "coach.sub" },
  { t: "ach.title", d: "ach.sub" },
  { t: "nav.reminders", d: "rem.sub" },
];

const MIN_STEPS: TKey[] = ["l3.min.1", "l3.min.2", "l3.min.3", "l3.min.4"];

const BEFORE: TKey[] = ["l3.ba.b1", "l3.ba.b2", "l3.ba.b3", "l3.ba.b4", "l3.ba.b5"];
const AFTER: TKey[] = ["l3.ba.a1", "l3.ba.a2", "l3.ba.a3", "l3.ba.a4", "l3.ba.a5"];
const MEMORY: TKey[] = ["l3.mem.i1", "l3.mem.i2", "l3.mem.i3", "l3.mem.i4", "l3.mem.i5"];
const GPT_ROWS: { a: TKey; b: TKey }[] = [
  { a: "l3.gpt.r1a", b: "l3.gpt.r1b" },
  { a: "l3.gpt.r2a", b: "l3.gpt.r2b" },
  { a: "l3.gpt.r3a", b: "l3.gpt.r3b" },
];


function Landing() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [heroI, setHeroI] = useState(0);
  const [quoteI, setQuoteI] = useState(0);
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  useEffect(() => {
    setHeroI(nextHeroIndex());
    setQuoteI(nextQuoteIndex());
    const id = window.setInterval(() => setHeroI((i) => (i + 1) % HERO_IMAGES.length), 7000);
    return () => window.clearInterval(id);
  }, []);
  const quote = LANDING_QUOTES[quoteI]!;

  /** AI-written, feature-specific motivation. Falls back to the static quotes. */
  const motivate = useServerFn(generateMotivation);
  const [aiLines, setAiLines] = useState<{ text: string; tag: string }[]>([]);
  const [lineI, setLineI] = useState(0);

  useEffect(() => {
    let alive = true;
    const cacheKey = `gl.motivation.${lang}`;
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cached) {
      try {
        setAiLines(JSON.parse(cached));
        return;
      } catch {
        /* regenerate below */
      }
    }
    void motivate({ data: { lang, count: 12 } })
      .then((res) => {
        if (!alive || !res.lines.length) return;
        setAiLines(res.lines);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.lines));
        } catch {
          /* storage full or blocked — keep the in-memory copy */
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang, motivate]);

  // Rotate through the generated lines so the hero keeps changing.
  useEffect(() => {
    if (aiLines.length < 2) return;
    const id = setInterval(() => setLineI((i) => (i + 1) % aiLines.length), 6000);
    return () => clearInterval(id);
  }, [aiLines.length]);

  const active = aiLines[lineI % Math.max(1, aiLines.length)];
  const heroLine = active?.text ?? (lang === "lt" ? quote.lt : quote.en);
  const heroTag = active?.tag ?? (lang === "lt" ? quote.by.lt : quote.by.en);
  // One strong statement instead of a wall of slogans.
  const tickerText = `${t("landing.ticker")} `.repeat(4);

  /** "Start now": if the user already has an active plan, ask before regenerating. */
  const startNow = async () => {
    if (!user) {
      navigate({ to: "/auth?mode=up" });
      return;
    }
    setCheckingPlan(true);
    try {
      const { data } = await supabase
        .from("plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (data) setPlanDialog(true);
      else navigate({ to: "/onboarding" });
    } catch {
      navigate({ to: "/onboarding" });
    } finally {
      setCheckingPlan(false);
    }
  };

  if (user)
    return (
      <AppShell>
        <Overview />
      </AppShell>
    );




  const features = [
    { icon: ClipboardList, t: "landing.f1.t", d: "landing.f1.d" },
    { icon: PlayCircle, t: "landing.f2.t", d: "landing.f2.d" },
    { icon: TrendingUp, t: "landing.f3.t", d: "landing.f3.d" },
    { icon: Timer, t: "landing.f4.t", d: "landing.f4.d" },
  ] as const;

  const stats: { v: TKey; l: TKey }[] = [
    { v: "landing.s1v", l: "landing.s1l" },
    { v: "landing.s2v", l: "landing.s2l" },
    { v: "landing.s3v", l: "landing.s3l" },
    { v: "landing.s4v", l: "landing.s4l" },
  ];


  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangSwitch />
          {user ? (
            <Button asChild variant="ghost" size="sm" className="gap-2 font-semibold">
              <Link to="/app">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <UserRound className="size-3.5" />
                </span>
                <span className="max-w-[10rem] truncate">{headerName(user) || t("landing.myPlan")}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">{t("landing.login")}</Link>
            </Button>
          )}
        </div>
      </header>

      {/* HERO — full-bleed image with the message laid over it on the left */}
      <section className="relative isolate w-full overflow-hidden">
        <img
          key={heroI}
          src={HERO_IMAGES[heroI]}
          alt={heroAlt(heroI, lang)}
          width={1920}
          height={1280}
          className="absolute inset-0 -z-10 size-full object-cover contrast-125"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/25" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-background/40" />

        <div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-16 md:min-h-[88vh] md:py-24">
          <div className="rise-in max-w-2xl">
            <span className="inline-flex items-center gap-2 border border-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              <Flame className="size-3.5" />
              {t("landing.tag")}
            </span>

            <h1 className="headline-xl mt-6 text-6xl md:text-8xl">
              <span className="block text-foreground">{t("landing.h1a")}</span>
              <span className="block text-primary">{t("landing.h1b")}</span>
              <span className="block text-foreground">{t("landing.h1c")}</span>
            </h1>

            <p className="mt-6 max-w-lg border-l-2 border-primary/60 pl-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {t("landing.sub2")}
            </p>

            <p className="mt-5 max-w-lg text-display text-2xl uppercase leading-tight text-accent md:text-3xl">
              {heroLine}
            </p>
            {heroTag && (
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                {heroTag}
              </p>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={() => {
                  tactileClick();
                  void startNow();
                }}
                disabled={checkingPlan}
                className="hard-shadow press h-14 rounded-sm px-8 text-display text-xl font-bold uppercase tracking-[0.14em] sm:px-10 sm:text-2xl"
              >
                {t("landing.ctaNow")}
                {checkingPlan ? <Loader2 className="ml-2 size-5 animate-spin" /> : <ArrowRight className="ml-2 size-5" />}
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-sm border bg-background/40 px-8 text-display text-xl font-bold uppercase tracking-[0.14em] backdrop-blur hover:bg-foreground hover:text-background sm:px-10 sm:text-2xl"
              >
                <Link to="/exercises">{t("landing.demo")}</Link>
              </Button>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("landing.trialNote")}
            </p>
          </div>
        </div>
      </section>


      {/* BRAND STATEMENT — said once */}
      <div className="border-y border-border bg-surface py-5 text-center">
        <p className="text-display text-2xl uppercase tracking-[0.2em] text-foreground md:text-3xl">
          {t("landing.ticker").replace(/\s*·\s*$/, "")}
        </p>
      </div>

      {/* STATS */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="sr-only">{t("landing.stats.heading")}</h2>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.l} delay={i * 90}>
              <div className="h-full bg-background px-6 py-8 text-center">
                <div className="text-display text-6xl tracking-wide text-primary">{t(s.v)}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {t(s.l)}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 60 SECONDS */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <GlowCard className="slab border-l-4 border-primary p-8 md:p-12">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
              <Timer className="size-3.5" />
              {t("l3.min.tag")}
            </span>
            <h2 className="headline-xl mt-3 max-w-2xl text-4xl md:text-6xl">{t("l3.min.title")}</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MIN_STEPS.map((k, i) => (
                <li key={k} className="border-t-2 border-primary/40 pt-3">
                  <span className="text-display text-3xl leading-none text-primary/40">{`0${i + 1}`}</span>
                  <p className="mt-2 text-sm font-semibold leading-snug text-foreground">{t(k)}</p>
                </li>
              ))}
            </ol>
            <Button
              size="lg"
              onClick={() => {
                tactileClick();
                void startNow();
              }}
              disabled={checkingPlan}
              className="hard-shadow press mt-8 min-h-14 h-auto whitespace-normal rounded-sm px-8 py-3 text-center text-display text-xl font-bold uppercase leading-tight tracking-[0.14em]"
            >
              {t("landing.cta")}
              {checkingPlan ? <Loader2 className="ml-2 size-5 animate-spin" /> : <ArrowRight className="ml-2 size-5" />}
            </Button>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("landing.trialNote")}
            </p>
          </GlowCard>
        </Reveal>
      </section>

      {/* PROBLEM → SOLUTION */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <h2 className="headline-xl text-4xl md:text-6xl">{t("l3.ba.title")}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="slab h-full border-l-4 border-muted-foreground/40 p-7">
              <h3 className="text-2xl uppercase text-muted-foreground">{t("l3.ba.before")}</h3>
              <ul className="mt-4 space-y-2.5">
                {BEFORE.map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="slab h-full border-l-4 border-primary p-7">
              <h3 className="text-2xl uppercase text-foreground">{t("l3.ba.after")}</h3>
              <ul className="mt-4 space-y-2.5">
                {AFTER.map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-sm font-semibold text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={i * 110}>
              <GlowCard className="slab group h-full p-8">
                <f.icon className="size-8 text-primary transition-transform group-hover:scale-110" />
                <h2 className="mt-5 text-3xl uppercase">{t(f.t)}</h2>
                <p className="mt-2 text-sm leading-snug text-muted-foreground transition-colors group-hover:text-foreground">
                  {t(f.d)}
                </p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRODUCT SHOWCASE — real app screens */}
      <section id="product" className="border-y border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
              {t("l2.show.tag")}
            </span>
            <h2 className="headline-xl mt-3 max-w-3xl text-4xl md:text-6xl">{t("l2.show.title")}</h2>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">{t("l2.show.sub")}</p>
          </Reveal>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {SCREENS.map((s, i) => (
              <Reveal key={s.t} delay={i * 80}>
                <figure className="group h-full">
                  <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                    <img
                      src={s.src}
                      alt={t(s.t)}
                      width={430}
                      height={560}
                      loading="lazy"
                      className="aspect-[430/560] w-full object-cover object-top"
                    />
                  </div>
                  <figcaption className="mt-4">
                    <h3 className="text-2xl uppercase">{t(s.t)}</h3>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{t(s.d)}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROFESSIONAL VIDEO LIBRARY */}
      <section className="border-y border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                  {lang === "lt" ? "TECHNIKOS BIBLIOTEKA" : "TECHNIQUE LIBRARY"}
                </span>
                <h2 className="headline-xl mt-3 max-w-3xl text-4xl md:text-6xl">
                  {lang === "lt" ? "Profesionali pratimų video biblioteka" : "A professional exercise video library"}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  {lang === "lt"
                    ? "Kiekvienas svarbus pratimas — aiškiai parodytas, su technikos akcentais ir greitu paleidimu tiesiai iš tavo treniruotės."
                    : "Every key movement, demonstrated clearly with technique focus and instant access from your workout."}
                </p>
              </div>
              <Button asChild variant="outline" className="shrink-0 rounded-full">
                <Link to="/exercises">{lang === "lt" ? "Atidaryti visą biblioteką" : "Open full library"}<ArrowRight className="ml-2 size-4" /></Link>
              </Button>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["/assets/videos/exercise-squat.mp4", lang === "lt" ? "Pritūpimai" : "Squat"],
              ["/assets/videos/exercise-deadlift.mp4", lang === "lt" ? "Mirties trauka" : "Deadlift"],
              ["/assets/videos/exercise-bench.mp4", lang === "lt" ? "Spaudimas gulint" : "Bench press"],
              ["/assets/videos/exercise-pullup.mp4", lang === "lt" ? "Prisitraukimai" : "Pull-up"],
            ].map(([src, title]) => (
              <Link to="/exercises" key={src} className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-panel transition duration-300 hover:-translate-y-1 hover:border-primary/40">
                <div className="relative aspect-video overflow-hidden bg-black">
                  <video src={src} muted loop autoPlay playsInline preload="metadata" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
                    <span className="text-display text-2xl uppercase text-white">{title}</span>
                    <PlayCircle className="size-7 text-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI DIFFERENTIATOR — memory */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{t("l3.mem.tag")}</span>
          <h2 className="headline-xl mt-3 max-w-3xl text-4xl md:text-6xl">{t("l3.mem.title")}</h2>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">{t("l3.mem.sub")}</p>
        </Reveal>

        <div className="mt-8 flex flex-wrap gap-2">
          {MEMORY.map((k) => (
            <span
              key={k}
              className="border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-foreground"
            >
              {t(k)}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="slab border border-border p-7 opacity-70">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("l3.mem.exQ")}</p>
            <p className="mt-3 text-lg leading-snug text-muted-foreground">{t("l3.mem.exA")}</p>
          </div>
          <GlowCard className="slab border-l-4 border-primary p-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{t("l3.mem.glQ")}</p>
            <p className="mt-3 text-lg font-semibold leading-snug text-foreground">{t("l3.mem.glA")}</p>
          </GlowCard>
        </div>

        {/* ChatGPT comparison */}
        <Reveal>
          <div className="mt-14 border border-border bg-surface/50 p-7 md:p-10">
            <h3 className="headline-xl text-3xl md:text-5xl">{t("l3.gpt.title")}</h3>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {GPT_ROWS.map((r) => (
                <div key={r.a} className="grid gap-2 py-4 md:grid-cols-2 md:gap-8">
                  <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>ChatGPT: {t(r.a)}</span>
                  </p>
                  <p className="flex items-start gap-2.5 text-sm font-semibold text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>GYMS.LIFE: {t(r.b)}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-display text-2xl uppercase leading-tight text-primary md:text-3xl">
              {t("l3.gpt.foot")}
            </p>
          </div>
        </Reveal>
      </section>

      {/* WHAT'S INSIDE — the real signed-in feature set */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <Reveal>
          <h2 className="headline-xl text-4xl md:text-6xl">{t("l3.inside.title")}</h2>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">{t("l3.inside.sub")}</p>
        </Reveal>
        <div className="mt-8 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {INSIDE.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 70}>
              <div className="h-full bg-background p-6">
                <div className="flex items-baseline gap-2">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  <h3 className="text-xl uppercase leading-tight">{t(f.t)}</h3>
                </div>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{t(f.d)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — 5 steps */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{t("l2.how.tag")}</span>
          <h2 className="headline-xl mt-3 max-w-3xl text-4xl md:text-6xl">{t("l2.how.title")}</h2>
        </Reveal>
        <ol className="mt-10 grid gap-px bg-border md:grid-cols-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.t} delay={i * 80}>
              <li className="h-full bg-background p-6">
                <span className="text-display text-5xl leading-none text-primary/30">{`0${i + 1}`}</span>
                <h3 className="mt-3 text-xl uppercase leading-tight">{t(s.t)}</h3>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{t(s.d)}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* WHO IT'S FOR */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <Reveal>
          <h2 className="headline-xl text-4xl md:text-6xl">{t("l2.who.title")}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.t} delay={i * 90}>
              <GlowCard className="slab h-full border-l-4 border-primary/70 p-7">
                <h3 className="text-2xl uppercase leading-tight">{t(a.t)}</h3>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">{t(a.d)}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: t(f.q),
              acceptedAnswer: { "@type": "Answer", text: t(f.a) },
            })),
          }),
        }}
      />
      <section id="faq" className="border-y border-border bg-surface/50">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Reveal>
            <h2 className="headline-xl text-4xl md:text-6xl">{t("l2.faq.title")}</h2>
          </Reveal>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-foreground marker:hidden">
                  {t(f.q)}
                  <ChevronDown className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(f.a)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>


      {/* QUOTE */}
      <Reveal>
        <section className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <Quote className="mx-auto size-8 text-accent" />
          <p className="headline-xl mt-5 text-4xl text-foreground md:text-6xl">
            {lang === "lt" ? quote.lt : quote.en}
          </p>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
            {lang === "lt" ? quote.by.lt : quote.by.en}
          </p>
        </section>
      </Reveal>

      {/* CTA BAND */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <GlowCard className="relative overflow-hidden border-l-4 border-primary bg-surface p-10 md:p-16">
            <div className="pointer-events-none absolute -right-16 -top-24 select-none text-display text-[16rem] tracking-tight leading-none text-primary/5">
              GO
            </div>
            <div className="relative">
              <h2 className="headline-xl max-w-2xl text-5xl md:text-7xl">
                {t("l3.final.title")}
              </h2>
              <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
                {t("landing.bandSub")}
              </p>
              <Button
                size="lg"
                onClick={() => {
                  tactileClick();
                  void startNow();
                }}
                disabled={checkingPlan}
                className="hard-shadow press mt-8 h-14 rounded-sm px-10 text-display text-2xl font-bold uppercase tracking-[0.14em]"
              >
                {t("landing.cta")}
                {checkingPlan ? <Loader2 className="ml-2 size-5 animate-spin" /> : <ArrowRight className="ml-2 size-5" />}
              </Button>
            </div>
          </GlowCard>
        </section>
      </Reveal>

      {/* FOOTER */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t("l2.foot.tagline")}
              </p>
            </div>
            <nav aria-label={t("l2.foot.product")}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-foreground">
                {t("l2.foot.product")}
              </h2>
              <ul className="mt-4 space-y-2 text-sm font-semibold">
                <li>
                  <a href="#product" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("l2.show.tag")}
                  </a>
                </li>
                <li>
                  <Link to="/exercises" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("l2.foot.exercises")}
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("footer.pricing")}
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label={t("l2.foot.support")}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-foreground">
                {t("l2.foot.support")}
              </h2>
              <ul className="mt-4 space-y-2 text-sm font-semibold">
                <li>
                  <a href="#faq" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("l2.foot.faq")}
                  </a>
                </li>
                <li>
                  <Link to="/auth" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("landing.login")}
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label={t("l2.foot.legal")}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.24em] text-foreground">
                {t("l2.foot.legal")}
              </h2>
              <ul className="mt-4 space-y-2 text-sm font-semibold">
                <li>
                  <Link to="/privacy" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("footer.privacy")}
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("footer.terms")}
                  </Link>
                </li>
                <li>
                  <Link to="/refund" className="text-muted-foreground transition-colors hover:text-primary">
                    {t("footer.refund")}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
            {t("footer.copyright").replace("{year}", new Date().getFullYear().toString())}
          </p>
        </div>
      </footer>


      <AlertDialog open={planDialog} onOpenChange={setPlanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("landing.hasPlanTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("landing.hasPlanDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate({ to: "/onboarding" })}>
              {t("landing.newPlan")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/app" })}>
              {t("landing.goToPlan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
