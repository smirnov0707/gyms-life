import React, { useState } from "react";
import {
  Pill,
  Sparkles,
  Plus,
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Apple,
  Check,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { scanMicronutrients } from "@/lib/micronutrient.functions";

type Supplement = {
  name: string;
  dose: string;
  category: string;
  times_per_day: number;
  with_food: boolean;
  preferred_time: string;
};

type Finding = {
  key: string;
  name: string;
  current: string;
  target: string;
  gapPercent: number;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  evidence: string;
  foodFix: string;
  supplement: Supplement | null;
};

type ScanResult = {
  summary: string;
  dataQuality: string;
  loggedDays: number;
  findings: Finding[];
  strengths: string[];
  warnings: string[];
  fallback: boolean;
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-rose-950 text-rose-400 border-rose-800",
  high: "bg-amber-950 text-accent border-amber-800",
  medium: "bg-indigo-950 text-indigo-300 border-indigo-800",
  low: "bg-emerald-950 text-primary border-emerald-800",
};

export const MicronutrientDeficiencyScanner: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const call = useServerFn(scanMicronutrients);

  const scan = useQuery<ScanResult>({
    queryKey: ["micro-scan", user?.id, lang],
    queryFn: async () => (await call({ data: { lang } })) as ScanResult,
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const insertSupplements = async (items: Supplement[]) => {
    if (!user) throw new Error("no user");
    const { data: existing, error: readError } = await supabase
      .from("supplements")
      .select("name")
      .eq("user_id", user.id);
    if (readError) throw readError;
    const have = new Set((existing ?? []).map((r) => r.name.trim().toLowerCase()));
    const rows = items
      .filter((s) => s.name && !have.has(s.name.trim().toLowerCase()))
      .map((s) => ({
        name: s.name,
        dose: s.dose,
        category: s.category || "vitamin",
        times_per_day: Math.max(1, s.times_per_day || 1),
        with_food: s.with_food ?? true,
        preferred_time: s.preferred_time || "morning",
        user_id: user.id,
        is_active: true,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from("supplements").insert(rows);
      if (error) throw error;
    }
    return rows.length;
  };

  const applyOne = useMutation({
    mutationFn: async (f: Finding) => {
      if (!f.supplement) return 0;
      const n = await insertSupplements([f.supplement]);
      return n;
    },
    onSuccess: async (_n, f) => {
      setAdded((prev) => ({ ...prev, [f.key]: true }));
      toast.success(t("sc.micro.applySuccess"));
      await qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
    onError: (error) => toast.error(errorMessage(error, t("common.error"))),
  });

  const applyAll = useMutation({
    mutationFn: async () => {
      const items = (scan.data?.findings ?? [])
        .map((f) => f.supplement)
        .filter(Boolean) as Supplement[];
      return insertSupplements(items);
    },
    onSuccess: async () => {
      const next: Record<string, boolean> = {};
      for (const f of scan.data?.findings ?? []) if (f.supplement) next[f.key] = true;
      setAdded((prev) => ({ ...prev, ...next }));
      toast.success(t("sc.micro.applySuccess"));
      await qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
    onError: (error) => toast.error(errorMessage(error, t("common.error"))),
  });

  const data = scan.data;
  const actionable = (data?.findings ?? []).filter((f) => f.supplement);
  const allApplied = actionable.length > 0 && actionable.every((f) => added[f.key]);

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              {t("sc.micro.title")} <Sparkles className="w-4 h-4 text-violet-400" />
            </h3>
            <p className="text-xs text-muted-foreground">{t("sc.micro.subtitle")}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("sc.micro.rescan")}
          onClick={() => scan.refetch()}
          disabled={scan.isFetching}
          className="rounded-xl text-xs shrink-0"
        >
          {scan.isFetching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {scan.isLoading && (
        <div className="py-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          {t("sc.micro.analyzing")}
        </div>
      )}

      {scan.isError && <p className="text-xs text-rose-400">{t("common.error")}</p>}

      {data && (
        <>
          {data.summary && (
            <p className="text-xs text-foreground/90 leading-relaxed">{data.summary}</p>
          )}

          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono uppercase text-muted-foreground">
            <span className="rounded-md bg-surface-2 px-2 py-1">
              {t("sc.micro.loggedDays").replace("{n}", String(data.loggedDays))}
            </span>
            {data.fallback && (
              <span className="rounded-md bg-surface-2 px-2 py-1 text-accent">
                {t("sc.micro.offline")}
              </span>
            )}
          </div>

          {data.dataQuality && (
            <p className="text-[11px] text-muted-foreground">{data.dataQuality}</p>
          )}

          <div className="space-y-2.5">
            {data.findings.map((d) => (
              <div
                key={d.key}
                className="p-3.5 rounded-2xl bg-surface border border-border space-y-1.5"
              >
                <div className="flex justify-between items-center gap-2 text-xs">
                  <span className="font-bold text-foreground text-sm">{d.name}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded border ${PRIORITY_STYLE[d.priority] ?? PRIORITY_STYLE["medium"]}`}
                  >
                    {t(`sc.micro.priority.${d.priority}`)} ·{" "}
                    {t("sc.micro.gap").replace("{n}", `${d.gapPercent}%`)}
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-500 transition-all"
                    style={{ width: `${d.gapPercent}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{d.reason}</p>
                {d.evidence && (
                  <p className="text-[11px] text-foreground/70 border-l-2 border-violet-500/50 pl-2">
                    {d.evidence}
                  </p>
                )}
                {d.foodFix && (
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <Apple className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" /> {d.foodFix}
                  </p>
                )}

                <div className="flex justify-between items-center gap-2 text-[10px] font-mono text-muted-foreground pt-1.5 border-t border-border">
                  <span>{t("sc.micro.currentIntake").replace("{n}", d.current)}</span>
                  <span className="text-foreground">
                    {t("sc.micro.recommended").replace("{n}", d.target)}
                  </span>
                </div>

                {d.supplement && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={added[d.key] || applyOne.isPending}
                    onClick={() => applyOne.mutate(d)}
                    className="rounded-xl text-[11px] w-full mt-1"
                  >
                    {added[d.key] ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <Check className="w-3.5 h-3.5" /> {t("sc.micro.addedOne")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> {d.supplement.name} · {d.supplement.dose}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {data.strengths.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 space-y-1">
              <p className="text-[10px] font-mono uppercase text-primary">
                {t("sc.micro.strengths")}
              </p>
              {data.strengths.map((s, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  • {s}
                </p>
              ))}
            </div>
          )}

          {data.warnings.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1">
              <p className="text-[10px] font-mono uppercase text-accent flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {t("sc.micro.warnings")}
              </p>
              {data.warnings.map((s, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  • {s}
                </p>
              ))}
            </div>
          )}

          {actionable.length > 0 && (
            <Button
              onClick={() => applyAll.mutate()}
              disabled={allApplied || applyAll.isPending || !user}
              className={`w-full font-bold rounded-2xl transition-all ${
                allApplied
                  ? "bg-emerald-950 border border-emerald-500/40 text-primary"
                  : "bg-gradient-to-r from-violet-500 to-indigo-600 hover:opacity-90 text-foreground shadow-lg shadow-violet-500/20"
              }`}
            >
              {allApplied ? (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> {t("sc.micro.applied")}
                </span>
              ) : applyAll.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("sc.micro.applying")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t("sc.micro.apply")}
                </span>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
