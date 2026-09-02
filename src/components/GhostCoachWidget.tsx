import React, { useEffect, useState } from "react";
import { Zap, Dumbbell, Apple, Activity, Flame, Shield } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { getProactiveCoachInsight } from "@/lib/ghost-coach.functions";

export const GhostCoachWidget: React.FC = () => {
  const { lang } = useI18n();
  const getInsightFn = useServerFn(getProactiveCoachInsight);

  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<{
    ok: boolean;
    headline?: string;
    readinessScore?: number;
    fatigueStatus?: string;
    trainingAdvice?: string;
    nutritionAdvice?: string;
    recommendedAction?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    getInsightFn({ data: { lang: lang || "lt" } })
      .then((res) => {
        if (isMounted) {
          setInsight(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lang]);

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl p-6 animate-pulse flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-3.5 w-28 bg-white/10 rounded-full" />
          <div className="h-6 w-64 bg-white/15 rounded-lg" />
        </div>
        <div className="w-16 h-16 rounded-full bg-white/10" />
      </div>
    );
  }

  const score = insight?.readinessScore || 88;
  const scoreColor =
    score >= 85 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-rose-400";
  const strokeColor = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-6 relative overflow-hidden space-y-5">
      {/* Foninis subtilus švytėjimas */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="badge-tech text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
              GHOST COACH • AUTONOMOUS AI
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-snug">
            {insight?.headline ||
              (lang === "lt"
                ? "Kūnas optimaliai pasiruošęs treniruotei"
                : "Body primed for training")}
          </h2>
        </div>

        {/* Pasirengimo žiedas */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="currentColor"
              strokeWidth="4.5"
              className="text-white/10"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke={strokeColor}
              strokeWidth="4.5"
              strokeDasharray="163"
              strokeDashoffset={163 - (163 * score) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`text-sm font-mono font-black ${scoreColor}`}>{score}%</span>
          </div>
        </div>
      </div>

      {/* Kortelių tinklelis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {insight?.trainingAdvice && (
          <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-200 shrink-0 mt-0.5">
              <Dumbbell className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block font-bold">
                {lang === "lt" ? "Treniruotės fokusas" : "Workout Focus"}
              </span>
              <p className="text-xs text-neutral-200 font-medium leading-relaxed mt-0.5">
                {insight.trainingAdvice}
              </p>
            </div>
          </div>
        )}

        {insight?.nutritionAdvice && (
          <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-200 shrink-0 mt-0.5">
              <Apple className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block font-bold">
                {lang === "lt" ? "Mitybos strategija" : "Nutrition Strategy"}
              </span>
              <p className="text-xs text-neutral-200 font-medium leading-relaxed mt-0.5">
                {insight.nutritionAdvice}
              </p>
            </div>
          </div>
        )}
      </div>

      {insight?.recommendedAction && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-xs font-mono text-neutral-300 relative z-10">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-white uppercase tracking-wider">
              {lang === "lt" ? "Dienos veiksmas:" : "Action:"}
            </strong>{" "}
            {insight.recommendedAction}
          </span>
        </div>
      )}
    </div>
  );
};

export default GhostCoachWidget;
