import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { buildRiskReport, type RiskLevel } from "@/lib/injury-risk";
import { cn } from "@/lib/utils";

const TONE: Record<RiskLevel, { text: string; border: string; bg: string; fill: string }> = {
  low: {
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    fill: "#10b981",
  },
  moderate: {
    text: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    fill: "#f59e0b",
  },
  high: {
    text: "text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    fill: "#f43f5e",
  },
};

export function InjuryRiskRadar() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["injury-risk", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [sets, sessions, checkins] = await Promise.all([
        supabase
          .from("set_logs")
          .select("created_at, exercise_slug, exercise_name, weight_kg, reps")
          .eq("user_id", user!.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select("started_at, total_volume")
          .eq("user_id", user!.id)
          .gte("started_at", since),
        supabase
          .from("daily_checkins")
          .select("checkin_on, soreness, readiness_score")
          .eq("user_id", user!.id)
          .order("checkin_on", { ascending: false })
          .limit(14),
      ]);
      return buildRiskReport(sets.data ?? [], sessions.data ?? [], checkins.data ?? []);
    },
  });

  const level = data?.level ?? "low";
  const tone = TONE[level];
  const Icon = !data?.hasData ? ShieldQuestion : level === "low" ? ShieldCheck : ShieldAlert;

  // Kūno zonų būsenos nustatymas pagal rizikos faktorius
  const pushFactor = data?.factors.find((f) => f.key.includes("balance"));
  const jumpFactor = data?.factors.find((f) => f.key.includes("jump"));
  const acwrFactor = data?.factors.find((f) => f.key.includes("acwr"));

  const shouldersRisk: RiskLevel =
    jumpFactor?.level === "high" || pushFactor?.level === "high"
      ? "high"
      : pushFactor?.level === "moderate"
        ? "moderate"
        : "low";
  const kneesRisk: RiskLevel =
    acwrFactor?.level === "high" ? "high" : acwrFactor?.level === "moderate" ? "moderate" : "low";
  const spineRisk: RiskLevel = data?.score && data.score > 40 ? "moderate" : "low";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-neutral-900/80 border border-white/10 p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Viršutinė antraštė & Bendras rizikos indeksas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl border p-2.5", tone.border, tone.bg, tone.text)}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {lang === "lt" ? "Biomechaninis Traumų Radaras" : "Injury Risk Radar"}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-neutral-400">
                AI ORCHESTRATOR
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400">
              {lang === "lt"
                ? "Realaus laiko sąnarių ir apkrovos telemetrija"
                : "Real-time joint load telemetry"}
            </p>
          </div>
        </div>

        {data?.hasData && (
          <div className="text-right flex items-center gap-3 bg-black/40 px-3.5 py-2 rounded-xl border border-white/5">
            <div>
              <span className="block text-[9px] font-mono uppercase text-neutral-400">
                {lang === "lt" ? "Rizikos Lygis" : "Risk Index"}
              </span>
              <span className={cn("text-xl font-bold font-mono", tone.text)}>
                {data.score}/100 · {level.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pagrindinis tinklelis: Kūno žemėlapis + Telemetrijos faktoriai */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Biomechaninis Kūno Žemėlapis (SVG HUD) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-black/50 border border-white/5 relative">
          <div className="text-[10px] font-mono text-neutral-400 mb-2 uppercase tracking-wider">
            {lang === "lt" ? "SĄNARIŲ APKROVOS ŽEMĖLAPIS" : "JOINT LOAD HEATMAP"}
          </div>

          <svg viewBox="0 0 200 280" className="w-44 h-60 drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
            {/* Galva / Kaklas */}
            <circle cx="100" cy="35" r="18" fill="#262626" stroke="#404040" strokeWidth="2" />

            {/* Pečiai / Krūtinė */}
            <path
              d="M 60 70 L 140 70 L 130 120 L 70 120 Z"
              fill={
                shouldersRisk === "high"
                  ? "#f43f5e"
                  : shouldersRisk === "moderate"
                    ? "#f59e0b"
                    : "#10b981"
              }
              fillOpacity="0.25"
              stroke={
                shouldersRisk === "high"
                  ? "#f43f5e"
                  : shouldersRisk === "moderate"
                    ? "#f59e0b"
                    : "#10b981"
              }
              strokeWidth="2"
              className="transition-colors duration-500 cursor-pointer hover:opacity-80"
              onClick={() =>
                setSelectedZone(lang === "lt" ? "Pečių juosta ir krūtinė" : "Shoulders & Chest")
              }
            />

            {/* Stuburas / Liemuo */}
            <line
              x1="100"
              y1="70"
              x2="100"
              y2="150"
              stroke={spineRisk === "moderate" ? "#f59e0b" : "#10b981"}
              strokeWidth="4"
              strokeDasharray="2,2"
            />

            {/* Rankos */}
            <line
              x1="60"
              y1="70"
              x2="40"
              y2="130"
              stroke="#525252"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <line
              x1="140"
              y1="70"
              x2="160"
              y2="130"
              stroke="#525252"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Dubuo */}
            <path
              d="M 70 120 L 130 120 L 120 150 L 80 150 Z"
              fill="#262626"
              stroke="#404040"
              strokeWidth="2"
            />

            {/* Kojos / Keliai */}
            <line
              x1="85"
              y1="150"
              x2="80"
              y2="210"
              stroke={
                kneesRisk === "high" ? "#f43f5e" : kneesRisk === "moderate" ? "#f59e0b" : "#10b981"
              }
              strokeWidth="7"
              strokeLinecap="round"
              className="cursor-pointer"
              onClick={() =>
                setSelectedZone(
                  lang === "lt" ? "Kelių sąnariai ir keturgalviai" : "Knees & Quadriceps",
                )
              }
            />
            <line
              x1="115"
              y1="150"
              x2="120"
              y2="210"
              stroke={
                kneesRisk === "high" ? "#f43f5e" : kneesRisk === "moderate" ? "#f59e0b" : "#10b981"
              }
              strokeWidth="7"
              strokeLinecap="round"
              className="cursor-pointer"
              onClick={() =>
                setSelectedZone(
                  lang === "lt" ? "Kelių sąnariai ir keturgalviai" : "Knees & Quadriceps",
                )
              }
            />

            {/* Blauzdos */}
            <line
              x1="80"
              y1="210"
              x2="78"
              y2="265"
              stroke="#404040"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <line
              x1="120"
              y1="210"
              x2="122"
              y2="265"
              stroke="#404040"
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Kelių sąnarių telemetrijos taškai */}
            <circle
              cx="80"
              cy="210"
              r="4"
              fill={kneesRisk === "high" ? "#f43f5e" : "#10b981"}
              className="animate-ping"
            />
            <circle
              cx="120"
              cy="210"
              r="4"
              fill={kneesRisk === "high" ? "#f43f5e" : "#10b981"}
              className="animate-ping"
            />
          </svg>

          <div className="flex items-center gap-3 mt-3 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Saugus
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Įspėjimas
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Pavojus
            </div>
          </div>
        </div>

        {/* Telemetrijos Faktoriai ir AI Rekomendacijos */}
        <div className="md:col-span-7 space-y-3">
          {!data?.hasData || !data.factors.length ? (
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center text-xs text-neutral-400">
              {t("nx.risk.empty")}
            </div>
          ) : (
            data.factors.map((f) => (
              <div
                key={f.key}
                className="p-3.5 rounded-xl border border-white/5 bg-black/40 hover:bg-black/60 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between font-semibold text-xs">
                  <span className="text-white">{t(f.key as never)}</span>
                  <span
                    className={cn(
                      "font-mono font-bold px-2 py-0.5 rounded",
                      TONE[f.level].bg,
                      TONE[f.level].text,
                    )}
                  >
                    {f.value}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {t(f.adviceKey as never)}
                </p>
              </div>
            ))
          )}

          {/* AI Coach Adaptive Action Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white block">
                  {lang === "lt" ? "AI Orkestratorius aktyvus" : "AI Orchestrator Active"}
                </span>
                <span className="text-neutral-400 text-[11px]">
                  {level === "low"
                    ? lang === "lt"
                      ? "Treniruočių planas optimizuotas pilnam pajėgumui."
                      : "Training plan operating at full capacity."
                    : lang === "lt"
                      ? "Pavojingi pratimai automatiškai pakeisti saugiomis alternatyvomis."
                      : "High-risk lifts automatically substituted with joint-safe variations."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InjuryRiskRadar;
