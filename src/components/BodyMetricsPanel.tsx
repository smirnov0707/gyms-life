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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { normalizeManualBodyMetric, type ManualBodyMetric } from "@/lib/body-metric.schema";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toBodyMetricWrite(metric: ManualBodyMetric) {
  const write: Database["public"]["Tables"]["body_metrics"]["Update"] = {};
  if (metric.weight_kg !== undefined) write.weight_kg = metric.weight_kg;
  if (metric.body_fat !== undefined) write.body_fat = metric.body_fat;
  return write;
}

/** Unified body metrics: log weight / body fat and see the progress curve in one place. */
export function BodyMetricsPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["metrics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_metrics")
        .select("measured_on, weight_kg, body_fat")
        .eq("user_id", user!.id)
        .order("measured_on", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const list = rows ?? [];
  const withWeight = list.filter((r) => r.weight_kg != null);
  const withFat = list.filter((r) => r.body_fat != null);
  const latestWeight = withWeight.at(-1)?.weight_kg ?? null;
  const latestFat = withFat.at(-1)?.body_fat ?? null;
  const firstWeight = withWeight[0]?.weight_kg ?? null;
  const delta =
    latestWeight != null && firstWeight != null ? Number(latestWeight) - Number(firstWeight) : null;

  const chart = withWeight.map((r) => ({
    date: new Date(r.measured_on).toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
    }),
    weight: Number(r.weight_kg),
    fat: r.body_fat != null ? Number(r.body_fat) : null,
  }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const metric = normalizeManualBodyMetric({
        ...(weight.trim() ? { weight_kg: weight } : {}),
        ...(fat.trim() ? { body_fat: fat } : {}),
      });
      const metricWrite = toBodyMetricWrite(metric);
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing, error: existingError } = await supabase
        .from("body_metrics")
        .select("id")
        .eq("user_id", user.id)
        .eq("measured_on", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;

      const { error } = existing
        ? await supabase.from("body_metrics").update(metricWrite).eq("id", existing.id)
        : await supabase
            .from("body_metrics")
            .insert({ user_id: user.id, measured_on: today, ...metricWrite });
      if (error) throw error;

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
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("bm.bodyFat")}
          </p>
          <p className="text-display text-3xl text-foreground">
            {latestFat != null ? Number(latestFat).toFixed(1) : "—"}{" "}
            <span className="text-sm text-muted-foreground">%</span>
          </p>
        </div>
        {delta != null && (
          <p className={`text-sm font-semibold ${delta > 0 ? "text-accent" : "text-primary"}`}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} {t("common.kg")}
          </p>
        )}
      </div>

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
