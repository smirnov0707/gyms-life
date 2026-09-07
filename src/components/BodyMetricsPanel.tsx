import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getBodyMetrics, recordManualBodyMetric } from "@/lib/body-metrics.functions";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Unified body metrics: log weight / body fat and see the progress curve in one place. */
/**
 * A one-line note under a headline figure saying it was not measured.
 *
 * Only ever shown for an estimate. A figure the athlete typed needs no
 * caveat, and a row written before provenance existed gets no claim either
 * way — a badge reading "measured" on a number nobody vouched for would be
 * the same defect in the other direction.
 */
function EstimateMark({ source }: { source: "measured" | "photo_estimate" | null }) {
  const { t } = useI18n();
  if (source !== "photo_estimate") return null;
  return <p className="mt-1 text-[11px] font-semibold text-accent">{t("bm.fromPhoto")}</p>;
}

export function BodyMetricsPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["metrics", user?.id],
    queryFn: () => getBodyMetrics(),
    enabled: !!user,
  });

  const list = rows?.metrics ?? [];
  const withWeight = list.filter((row) => row.weightKg != null);
  const withFat = list.filter((row) => row.bodyFat != null);
  const latestWeightRow = withWeight.at(-1) ?? null;
  const latestFatRow = withFat.at(-1) ?? null;
  const latestWeight = latestWeightRow?.weightKg ?? null;
  const latestFat = latestFatRow?.bodyFat ?? null;
  // The photo scan writes into these same two columns. A figure it estimated
  // from an image is not a measurement, and this is the screen the athlete
  // comes to precisely to read their own measurements.
  const estimatedPoints = withWeight.filter((row) => row.weightSource === "photo_estimate").length;
  const firstWeight = withWeight[0]?.weightKg ?? null;
  const delta =
    latestWeight != null && firstWeight != null ? Number(latestWeight) - Number(firstWeight) : null;

  const chart = withWeight.map((r) => ({
    date: new Date(r.measuredOn).toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
    }),
    weight: r.weightKg,
    fat: r.bodyFat,
  }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await recordManualBodyMetric({
        data: {
          ...(weight.trim() ? { weight_kg: weight } : {}),
          ...(fat.trim() ? { body_fat: fat } : {}),
        },
      });

      setWeight("");
      setFat("");
      toast.success(t("pr.save"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["metrics", user.id] }),
        qc.invalidateQueries({ queryKey: ["latest-body-metric", user.id] }),
      ]);
    } catch (error) {
      toast.error(errorMessage(error, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {t("landing.cmd.bodyMetrics")}
        </h3>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("bm.weight")}
          </p>
          <p className="text-display text-3xl text-foreground">
            {latestWeight != null ? Number(latestWeight).toFixed(1) : "—"}{" "}
            <span className="text-sm text-muted-foreground">{t("common.kg")}</span>
          </p>
          <EstimateMark source={latestWeightRow?.weightSource ?? null} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("bm.bodyFat")}
          </p>
          <p className="text-display text-3xl text-foreground">
            {latestFat != null ? Number(latestFat).toFixed(1) : "—"}{" "}
            <span className="text-sm text-muted-foreground">%</span>
          </p>
          <EstimateMark source={latestFatRow?.bodyFatSource ?? null} />
        </div>
        {delta != null && (
          <p className={`text-sm font-semibold ${delta > 0 ? "text-accent" : "text-primary"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} {t("common.kg")}
          </p>
        )}
      </div>

      {estimatedPoints > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-accent">
          {t("bm.chartEstimated").replace("{n}", String(estimatedPoints))}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          inputMode="decimal"
          min="0.01"
          max="500"
          step="0.01"
          placeholder={t("common.kg")}
          className="h-10 w-24"
        />
        <Input
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          placeholder="%"
          className="h-10 w-20"
        />
        <Button
          size="sm"
          onClick={save}
          disabled={saving || (!weight && !fat)}
          className="rounded-full"
        >
          {t("pr.addWeight")}
        </Button>
      </div>

      {chart.length > 1 ? (
        <div className={compact ? "mt-5 h-40" : "mt-6 h-64"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="bmw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis domain={["auto", "auto"]} stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                }}
              />
              <Area
                type="monotone"
                dataKey="weight"
                name={t("bm.weight")}
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#bmw)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t("pr.empty")}</p>
      )}
    </div>
  );
}
