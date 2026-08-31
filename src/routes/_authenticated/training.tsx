import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, ArrowRight, Brain, Check, Clock3, Dumbbell, Flame, Play, Target } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/training')({ component: TrainingPage })

const exercises = [
  { name: 'Squat', detail: '4 × 8', focus: 'Quads · Glutes' },
  { name: 'Romanian Deadlift', detail: '3 × 10', focus: 'Hamstrings · Glutes' },
  { name: 'Bench Press', detail: '4 × 8', focus: 'Chest · Triceps' },
  { name: 'Cable Row', detail: '3 × 10', focus: 'Back · Biceps' },
]

function TrainingPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><Activity className="h-4 w-4" /> Today's training</div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Build the session. Own the result.</h1>
              <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">A focused session shaped by your readiness, recent performance and goals.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/training/active" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:opacity-90"><Play className="h-4 w-4 fill-current" /> Start workout</Link>
                <Link to="/exercises" className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-semibold transition hover:bg-muted">Browse exercises <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2"><Stat icon={<Brain />} label="Readiness" value="82%" /><Stat icon={<Clock3 />} label="Duration" value="48 min" /><Stat icon={<Dumbbell />} label="Volume" value="6.4k kg" /><Stat icon={<Flame />} label="Streak" value="7 days" /></div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Today's plan</p><h2 className="mt-1 text-2xl font-black">Upper / Lower Strength</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">4 exercises</span></div>
            <div className="space-y-3">{exercises.map((exercise, index) => <div key={exercise.name} className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 transition hover:border-primary/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-black">{String(index + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><p className="font-bold">{exercise.name}</p><p className="text-sm text-muted-foreground">{exercise.focus}</p></div><div className="text-right"><p className="font-black">{exercise.detail}</p><p className="text-xs text-muted-foreground">target</p></div></div>)}</div>
          </div>
          <aside className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2 text-primary"><Target className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">GYMS.LIFE Coach</span></div><h2 className="mt-4 text-2xl font-black">Push today. Don't chase fatigue.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Your readiness supports a normal strength session. Keep 1–2 reps in reserve on the first working sets and progress only when technique stays clean.</p><div className="mt-6 rounded-2xl bg-muted p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's focus</p><p className="mt-2 font-semibold">Quality reps → progressive overload → controlled finish</p></div></aside>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <MiniCard title="Warm-up" text="5–8 min · mobility + ramp sets" icon={<Flame />} />
          <MiniCard title="Training target" text="RPE 7–8 · 1–2 reps in reserve" icon={<Target />} />
          <MiniCard title="Finish" text="Log every working set before ending" icon={<Check />} />
        </section>
      </div>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-border bg-background p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div> }
function MiniCard({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) { return <div className="rounded-[1.5rem] border border-border bg-card p-5"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div> }
