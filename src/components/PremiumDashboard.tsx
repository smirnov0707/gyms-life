import React, { useMemo } from "react";
import { ArrowRight, BarChart3, Flame, HeartPulse, Play, Sparkles, Trophy, Utensils, Zap, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Overview } from "@/components/Overview";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const cards = [
  ["LOWER BODY", "SQUAT", "/assets/videos/exercise-squat.mp4"],
  ["POSTERIOR CHAIN", "DEADLIFT", "/assets/videos/exercise-deadlift.mp4"],
  ["UPPER BODY", "BENCH PRESS", "/assets/videos/exercise-bench.mp4"],
  ["BODYWEIGHT", "PULL-UP", "/assets/videos/exercise-pullup.mp4"],
] as const;

function Stat({ label, value, meta, Icon }: { label: string; value: string; meta: string; Icon: LucideIcon }) {
  return (
    <div className="premium-stat">
      <div className="premium-stat-icon"><Icon className="size-5" /></div>
      <div className="min-w-0">
        <div className="premium-stat-label">{label}</div>
        <div className="premium-stat-value">{value}</div>
        <div className="premium-stat-meta">{meta}</div>
      </div>
    </div>
  );
}

export function PremiumDashboard() {
  const { user } = useAuth();
  const { data: sessions = [] } = useQuery({
    queryKey: ["premium-dashboard-sessions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("id, started_at, total_volume")
        .eq("user_id", user!.id)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: nutrition = [] } = useQuery({
    queryKey: ["premium-dashboard-nutrition", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_logs")
        .select("calories")
        .eq("user_id", user!.id)
        .eq("logged_on", new Date().toISOString().slice(0, 10));
      return data ?? [];
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    const days = new Set(sessions.map((s) => new Date(s.started_at).toDateString()));
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
      if (days.has(cursor.toDateString())) streak++;
      else if (i > 0) break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      workouts: sessions.length,
      volume: Math.round(sessions.reduce((sum, s) => sum + Number(s.total_volume ?? 0), 0)),
      streak,
      kcal: Math.round(nutrition.reduce((sum, r) => sum + Number(r.calories ?? 0), 0)),
    };
  }, [sessions, nutrition]);

  return (
    <div className="premium-dashboard space-y-5">
      <section className="premium-hero relative overflow-hidden">
        <video className="premium-hero-video" src="/assets/videos/exercise-squat.mp4" autoPlay muted loop playsInline preload="metadata" />
        <div className="premium-hero-overlay" />
        <div className="relative z-10 grid min-h-[470px] items-end gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.8fr] lg:p-10">
          <div className="max-w-3xl">
            <div className="premium-eyebrow"><Sparkles className="size-3.5" /> Elite movement. mastered.</div>
            <h1 className="premium-title">A professional exercise video library</h1>
            <p className="premium-subtitle">Every key movement, demonstrated clearly with technique focus and instant access from your workout.</p>
            <Link to="/exercises" className="premium-outline-button mt-7">Open full library <ArrowRight className="size-4" /></Link>
          </div>
          <div className="hidden lg:block" />
        </div>
      </section>

      <section className="premium-video-grid">
        {cards.map(([tag, name, src]) => (
          <Link key={name} to="/exercises" className="premium-video-card group">
            <video className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" src={src} autoPlay muted loop playsInline preload="metadata" />
            <div className="premium-video-overlay" />
            <div className="absolute left-4 top-4 rounded-full border border-lime-300/25 bg-black/55 px-2.5 py-1 text-[8px] font-black tracking-[0.16em] text-lime-200 backdrop-blur">{tag}</div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <div><div className="premium-video-title">{name}</div><div className="premium-video-meta">Technique guide</div></div>
              <span className="premium-play"><Play className="size-4 fill-current" /></span>
            </div>
          </Link>
        ))}
      </section>
      <div className="premium-carousel-dots"><span className="active" /><span /><span /></div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="premium-feature-card premium-difference">
          <div className="premium-eyebrow">The difference</div>
          <h2 className="premium-card-title">Not another AI chatbot</h2>
          <p className="premium-card-copy">GYMS.LIFE remembers your training. That is why every next session gets smarter.</p>
          <div className="premium-chip-row">
            {["Your weights", "Your sets", "Your records", "Your progress", "Your goal"].map((x) => <span key={x}><Zap className="size-3.5" />{x}</span>)}
          </div>
        </div>

        <div className="premium-feature-card premium-answer">
          <div className="premium-eyebrow">GYMS.LIFE answer</div>
          <div className="premium-answer-layout">
            <div>
              <p className="premium-answer-text">{sessions.length ? "Your training history is connected. Your next recommendation will be based on your logged performance." : "Log your first workout and GYMS.LIFE will build your personalized progression."}</p>
              <div className="premium-progress"><span style={{ width: sessions.length ? "72%" : "12%" }} /></div>
              <div className="premium-answer-meta">PROGRESSIVE OVERLOAD · PERSONALIZED</div>
            </div>
            <div className="premium-body-orb"><HeartPulse className="size-10" /></div>
          </div>
        </div>
      </section>

      <section className="premium-stats-grid">
        <Stat label="Workouts this week" value={String(metrics.workouts)} meta="Training sessions" Icon={BarChart3} />
        <Stat label="Total volume" value={`${metrics.volume.toLocaleString("lt-LT")} kg`} meta="Logged training volume" Icon={BarChart3} />
        <Stat label="Streak" value={String(metrics.streak)} meta="Consecutive days" Icon={Flame} />
        <Stat label="PR achieved" value="—" meta="Personal records" Icon={Trophy} />
        <Stat label="Calories burned" value={metrics.kcal ? `${metrics.kcal.toLocaleString("lt-LT")} kcal` : "—"} meta="Nutrition log today" Icon={Utensils} />
      </section>

      <Link to="/coach" className="premium-coach-bar">
        <span className="premium-coach-label"><Sparkles className="size-4" /> AI Coach</span>
        <span className="premium-coach-placeholder">Ask anything about training, nutrition or recovery...</span>
        <span className="premium-coach-arrow"><ArrowRight className="size-5" /></span>
      </Link>

      <div className="premium-overview-shell">
        <div className="premium-section-label">Your performance workspace</div>
        <Overview />
      </div>
    </div>
  );
}
