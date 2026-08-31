import React from "react";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Overview } from "@/components/Overview";

const cards = [
  ["LOWER BODY", "SQUAT", "/assets/videos/exercise-squat.mp4"],
  ["POSTERIOR CHAIN", "DEADLIFT", "/assets/videos/exercise-deadlift.mp4"],
  ["UPPER BODY", "BENCH PRESS", "/assets/videos/exercise-bench.mp4"],
  ["BODYWEIGHT", "PULL-UP", "/assets/videos/exercise-pullup.mp4"],
] as const;

export function PremiumDashboard() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#090b09] shadow-[0_40px_110px_-55px_rgba(190,242,100,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(190,242,100,0.11),transparent_34%),linear-gradient(110deg,rgba(255,255,255,0.025),transparent_48%)]" />
        <div className="relative p-5 sm:p-7 lg:p-9">
          <div className="grid items-end gap-7 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-lime-300">
                <Sparkles className="h-3.5 w-3.5" /> Elite movement. Mastered.
              </div>
              <h1 className="max-w-3xl text-[clamp(2.8rem,6vw,5.9rem)] font-black uppercase leading-[0.86] tracking-[-0.055em] text-white">
                A professional exercise video library
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                Every key movement, demonstrated clearly with technique focus and instant access from your workout.
              </p>
            </div>
            <div className="hidden min-h-[250px] overflow-hidden rounded-3xl border border-white/[0.07] bg-black/30 xl:block">
              <video className="h-full w-full object-cover opacity-75" src="/assets/videos/exercise-squat.mp4" autoPlay muted loop playsInline preload="metadata" />
              <div className="absolute right-9 top-9 rounded-full border border-lime-300/30 bg-black/55 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-lime-200 backdrop-blur">
                GYMS.LIFE / MOVEMENT INTELLIGENCE
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([tag, name, src]) => (
              <Link key={name} to="/exercises" className="group relative aspect-[1.02] overflow-hidden rounded-2xl border border-white/[0.12] bg-zinc-950">
                <video className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" src={src} autoPlay muted loop playsInline preload="metadata" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute left-3 top-3 rounded-full border border-lime-300/25 bg-black/55 px-2.5 py-1 text-[8px] font-bold tracking-[0.16em] text-lime-200 backdrop-blur">{tag}</div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                  <div>
                    <div className="text-[clamp(1.25rem,2.4vw,2rem)] font-black uppercase leading-none tracking-[-0.035em] text-white">{name}</div>
                    <div className="mt-2 text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-300">Technique guide</div>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-lime-300/75 bg-black/45 text-lime-300 backdrop-blur transition group-hover:bg-lime-300 group-hover:text-black">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Movement library · technique first · video ready</div>
            <Link to="/exercises" className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:text-lime-300">
              Open full library <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <Overview />
    </div>
  );
}
