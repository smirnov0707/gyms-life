import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Trophy, Flame, Activity } from "lucide-react";

const movements = [
  { name: "SQUAT", tag: "LOWER BODY", src: "/assets/videos/exercise-squat.mp4", to: "/exercises" },
  { name: "DEADLIFT", tag: "POSTERIOR CHAIN", src: "/assets/videos/exercise-deadlift.mp4", to: "/exercises" },
  { name: "BENCH PRESS", tag: "UPPER BODY", src: "/assets/videos/exercise-bench.mp4", to: "/exercises" },
  { name: "PULL-UP", tag: "BODYWEIGHT", src: "/assets/videos/exercise-pullup.mp4", to: "/exercises" },
];

export function DashboardShowcase() {
  return (
    <section className="relative mb-7 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0d0a] shadow-[0_35px_100px_-45px_rgba(190,242,100,0.24)]">
      <div className="pointer-events-none absolute -right-28 -top-36 h-[480px] w-[480px] rounded-full bg-lime-300/[0.07] blur-3xl" />
      <div className="relative px-5 pb-6 pt-7 sm:px-7 lg:px-9 lg:pt-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-lime-300">Elite movement. Mastered.</p>
            <h2 className="max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              A professional exercise video library
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Every key movement, demonstrated clearly with technique focus and instant access from your workout.
            </p>
          </div>
          <Link to="/exercises" className="group inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-lime-300/30 bg-lime-300/[0.04] px-4 py-3 text-xs font-bold text-white transition hover:border-lime-300/60 hover:bg-lime-300/[0.08] lg:self-auto">
            Open full library <ArrowRight className="h-4 w-4 text-lime-300 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {movements.map((movement) => (
            <Link key={movement.name} to={movement.to} className="group relative aspect-[1.12/1] overflow-hidden rounded-2xl border border-white/[0.11] bg-zinc-900">
              <video className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" src={movement.src} autoPlay muted loop playsInline preload="metadata" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                <span className="rounded-full border border-lime-300/25 bg-black/45 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-lime-200 backdrop-blur">{movement.tag}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <div>
                  <h3 className="text-2xl font-black uppercase leading-none tracking-[-0.03em] text-white">{movement.name}</h3>
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-300">Technique guide</p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-lime-300/70 bg-black/40 text-lime-300 backdrop-blur transition group-hover:bg-lime-300 group-hover:text-black">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-lime-300"><Activity className="h-3.5 w-3.5" /> Training intelligence</div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">Your next session gets smarter.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-lime-300"><Trophy className="h-3.5 w-3.5" /> Performance</div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">Track PRs, volume and progression.</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-lime-300"><Flame className="h-3.5 w-3.5" /> Consistency</div>
            <p className="mt-2 text-sm font-semibold text-zinc-100">Keep momentum visible every week.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
