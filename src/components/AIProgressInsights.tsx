import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, CheckCircle2, Info } from "lucide-react";
import { getProgressIntelligence } from "@/lib/progress-intelligence.functions";

const tone = {
  PROGRESSING: { icon: CheckCircle2, label: "Progresas", className: "border-primary/30 bg-primary/5" },
  STAGNATING: { icon: Info, label: "Stagnacija", className: "border-border bg-surface-2" },
  FATIGUE_RISK: { icon: AlertTriangle, label: "Nuovargio signalas", className: "border-accent/30 bg-accent/5" },
  INSUFFICIENT_DATA: { icon: Info, label: "Dar per mažai duomenų", className: "border-border bg-surface-2" },
} as const;

export function AIProgressInsights() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["progress-intelligence"], queryFn: () => getProgressIntelligence(), staleTime: 60_000 });
  if (isLoading) return <section className="panel p-6"><div className="flex items-center gap-2"><Brain className="size-5 text-primary" /><h2 className="text-2xl">AI Insights</h2></div><div className="mt-5 h-28 animate-pulse rounded-xl bg-surface-2" /></section>;
  if (isError || !data || data.status === "NO_DATA") return <section className="panel p-6"><div className="flex items-center gap-2"><Brain className="size-5 text-primary" /><h2 className="text-2xl">AI Insights</h2></div><p className="mt-3 text-sm text-muted-foreground">Kai turėsime pakankamai atliktų setų, čia atsiras tavo progreso signalai.</p></section>;
  return <section className="panel p-6"><div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2"><Brain className="size-5 text-primary" /><h2 className="text-2xl">AI Insights</h2></div><p className="mt-1 text-sm text-muted-foreground">Signalai apskaičiuoti iš tavo realių treniruočių duomenų.</p></div><span className="hidden text-xs text-muted-foreground sm:block">Evidence-based</span></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{data.insights.slice(0, 8).map(({ exerciseSlug, exerciseName, insight }) => { const config = tone[insight.signal]; const Icon = config.icon; return <article key={exerciseSlug} className={`rounded-2xl border p-4 ${config.className}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{config.label}</p><h3 className="mt-1 text-lg font-semibold">{exerciseName}</h3></div><Icon className="mt-1 size-5 shrink-0 text-primary" /></div><p className="mt-3 text-sm font-medium">{insight.headline}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{insight.explanation}</p><div className="mt-3 flex flex-wrap gap-2">{insight.evidence.map((item) => <span key={item.metric} className="rounded-full bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">{item.metric.replaceAll("_", " ")}: <strong className="text-foreground">{item.value}{item.metric.includes("pct") ? "%" : ""}</strong></span>)}<span className="rounded-full bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">confidence: <strong className="text-foreground">{Math.round(insight.confidence * 100)}%</strong></span></div><div className="mt-4 rounded-xl bg-background/50 p-3 text-sm"><span className="font-semibold">Rekomendacija: </span>{insight.recommendation}</div></article>; })}</div></section>;
}
