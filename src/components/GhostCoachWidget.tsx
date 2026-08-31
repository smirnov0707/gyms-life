import React, { useEffect, useState } from "react";
import { Zap, Activity, BatteryCharging, AlertCircle, Dumbbell, Apple } from "lucide-react";
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
      <div className="rounded-2xl bg-neutral-900/60 border border-white/10 p-5 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="h-6 w-56 bg-white/15 rounded" />
        </div>
        <div className="w-14 h-14 rounded-full bg-white/10" />
      </div>
    );
  }

  const score = insight?.readinessScore || 88;
  const scoreColor = score >= 85 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-rose-400";
  const strokeColor = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-black/90 border border-white/10 p-5 backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
              GHOST COACH AI AUTONOMOUS
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
            {insight?.headline || (lang === "lt" ? "Kūnas optimaliai pasiruošęs treniruotei" : "Body primed for training")}
          </h3>
        </div>

        {/* Pasirengimo ratas */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-14 h-14 transform -rotate-90">
            <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4" className="text-white/10" fill="transparent" />
            <circle
              cx="28"
              cy="28"
              r="22"
              stroke={strokeColor}
              strokeWidth="4"
              strokeDasharray="138"
              strokeDashoffset={138 - (138 * score) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`text-xs font-mono font-black ${scoreColor}`}>{score}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {insight?.trainingAdvice && (
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                {lang === "lt" ? "Treniruotės fokusas" : "Workout Focus"}
              </span>
              <p className="text-xs text-neutral-200 font-medium leading-relaxed">{insight.trainingAdvice}</p>
            </div>
          </div>
        )}

        {insight?.nutritionAdvice && (
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Apple className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                {lang === "lt" ? "Mitybos strategija" : "Nutrition Strategy"}
              </span>
              <p className="text-xs text-neutral-200 font-medium leading-relaxed">{insight.nutritionAdvice}</p>
            </div>
          </div>
        )}
      </div>

      {insight?.recommendedAction && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-neutral-300">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span><strong className="text-amber-300">{lang === "lt" ? "Veiksmas:" : "Action:"}</strong> {insight.recommendedAction}</span>
        </div>
      )}
    </div>
  );
};

export default GhostCoachWidget;
