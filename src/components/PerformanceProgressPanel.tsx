import { useQuery } from "@tanstack/react-query";
import { BarChart3, Dumbbell, Gauge, TrendingUp } from "lucide-react";
import {
  getPerformanceOverview,
  getStrengthTrend,
  getVolumeTrend,
} from "@/lib/performance.functions";
import { GlowCard } from "@/components/GlowCard";

function Metric({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: typeof BarChart3;
}) {
  return (
    <GlowCard className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-3 text-3xl font-bold">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>}
      </div>
    </GlowCard>
  );
}

export function PerformanceProgressPanel() {
  const overview = useQuery({
    queryKey: ["performance-overview"],
    queryFn: () => getPerformanceOverview(),
    staleTime: 60_000,
  });
  const volume = useQuery({
    queryKey: ["volume-trend"],
    queryFn: () => getVolumeTrend(),
    staleTime: 60_000,
  });
  const strength = useQuery({
    queryKey: ["strength-trend"],
    queryFn: () => getStrengthTrend(),
    staleTime: 60_000,
  });

  if (overview.isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <GlowCard key={i} className="panel h-32 animate-pulse" />
        ))}
      </div>
    );
  if (overview.isError || !overview.data || overview.data.status !== "READY")
    return (
      <GlowCard className="panel p-6">
        <p className="font-semibold">Nepavyko įkelti performance duomenų.</p>
        <p className="mt-1 text-sm text-muted-foreground">Pabandyk dar kartą po akimirkos.</p>
      </GlowCard>
    );

  const m = overview.data.metrics;
  const maxVolume = Math.max(1, ...(volume.data?.points ?? []).map((p) => p.volume));
  const strengthPoints = (strength.data?.points ?? []).slice(-14);
  const maxStrength = Math.max(1, ...strengthPoints.map((p) => p.estimated1RMKg));

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Performance</p>
        <h2 className="mt-1 text-3xl">Real training progress</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Rodikliai apskaičiuoti iš užbaigtų treniruočių ir atliktų setų. Estimated 1RM yra
          išvestinis rodiklis, o ne faktinis pakeltas svoris.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Workouts" value={m.workouts} icon={Dumbbell} />
        <Metric
          label="Total Volume"
          value={m.totalVolume.toLocaleString()}
          suffix="kg"
          icon={BarChart3}
        />
        <Metric label="Total Sets" value={m.totalSets} icon={Dumbbell} />
        <Metric label="Average RPE" value={m.averageRpe ?? "—"} icon={Gauge} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlowCard className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Volume Trend
              </p>
              <h3 className="mt-1 text-2xl">Training volume</h3>
            </div>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="mt-6 flex h-48 items-end gap-2">
            {(volume.data?.points ?? []).slice(-14).map((p, i) => (
              <div key={`${p.date}-${i}`} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (p.volume / maxVolume) * 100)}%` }}
                  title={`${p.workout}: ${p.volume} kg`}
                />
                <span className="mt-2 truncate text-center text-[10px] text-muted-foreground">
                  {new Date(p.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </GlowCard>
        <GlowCard className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Strength Trend
              </p>
              <h3 className="mt-1 text-2xl">Estimated 1RM</h3>
            </div>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="mt-6 flex h-48 items-end gap-2">
            {strengthPoints.map((p, i) => (
              <div
                key={`${p.date}-${p.exerciseSlug}-${i}`}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (p.estimated1RMKg / maxStrength) * 100)}%` }}
                  title={`${p.exerciseName}: ${p.estimated1RMKg} kg e1RM`}
                />
                <span className="mt-2 truncate text-center text-[10px] text-muted-foreground">
                  {p.exerciseName}
                </span>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {overview.data.exercises.map((e) => (
          <GlowCard key={e.exerciseSlug} className="panel p-5">
            <h3 className="font-semibold">{e.exerciseName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {e.sessions} sessions · {e.totalSets} sets · {e.totalReps} reps
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-muted-foreground">Best weight</div>
                <div className="mt-1 text-lg font-bold">{e.bestWeightKg ?? "—"} kg</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-xs text-muted-foreground">Estimated 1RM</div>
                <div className="mt-1 text-lg font-bold">{e.bestEstimated1RMKg ?? "—"} kg</div>
              </div>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Volume {e.totalVolume.toLocaleString()} kg</span>
              <span>RPE {e.averageRpe ?? "—"}</span>
            </div>
          </GlowCard>
        ))}
      </div>
    </section>
  );
}
