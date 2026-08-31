import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowRight, Brain, Check, Clock3, Dumbbell, Flame, Play, Sparkles, Target, RefreshCw } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/training')({ component: TrainingPage })

type PlanExercise = { name?: string; slug?: string; sets?: number; reps?: string; rest_seconds?: number; notes?: string }
type PlanDay = { day?: number; title?: string; focus?: string; warmup?: string; cooldown?: string; estimated_minutes?: number; exercises?: PlanExercise[] }
type GeneratedPlan = { title?: string; summary?: string; weeks?: number; progression?: string; nutrition?: string; days?: PlanDay[] }

function TrainingPage() {
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (active) setLoading(false); return }
      const { data } = await supabase.from('plans').select('title, weeks, days_per_week, data, goal').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (active) {
        const stored = (data?.data ?? {}) as GeneratedPlan
        setPlan({ ...stored, title: stored.title || data?.title, weeks: stored.weeks || data?.weeks })
        setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const days = plan?.days ?? []
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const today = days.length ? days[todayIndex % days.length] : null
  const totalExercises = useMemo(() => days.reduce((sum, day) => sum + (day.exercises?.length ?? 0), 0), [days])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><Activity className="h-4 w-4" /> Training hub</div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Train with a plan built for you.</h1>
              <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">Your program is generated from your goals, experience, equipment, schedule and personal constraints — then becomes the foundation for every session.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {today ? <Link to="/training/active" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:opacity-90"><Play className="h-4 w-4 fill-current" /> Start today's workout</Link> : null}
                <Link to="/onboarding" className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-semibold transition hover:bg-muted"><Sparkles className="h-4 w-4" /> {plan ? 'Rebuild my program' : 'Create my program'}</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <Stat icon={<Target />} label="Program" value={plan ? `${plan.weeks ?? 8} weeks` : 'Not set'} />
              <Stat icon={<Dumbbell />} label="Training days" value={plan ? `${days.length}` : '—'} />
              <Stat icon={<Activity />} label="Exercises" value={plan ? `${totalExercises}` : '—'} />
              <Stat icon={<Flame />} label="Status" value={plan ? 'Active' : 'Build plan'} />
            </div>
          </div>
        </section>

        {loading ? <LoadingCard /> : !plan ? <EmptyPlan /> : <>
          <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">My program</p><h2 className="mt-1 text-2xl font-black">{plan.title || 'Personal Training Program'}</h2><p className="mt-2 text-sm text-muted-foreground">{plan.summary}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{days.length} days / week</span></div>
              <div className="space-y-3">{days.map((day, index) => <div key={`${day.day}-${index}`} className={`rounded-2xl border p-4 transition ${today === day ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'}`}><div className="flex items-center gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-black">{String(day.day ?? index + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{day.title || `Training day ${index + 1}`}</p>{today === day && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-primary-foreground">Today</span>}</div><p className="text-sm text-muted-foreground">{day.focus}</p></div><div className="text-right"><p className="font-black">{day.exercises?.length ?? 0} exercises</p><p className="text-xs text-muted-foreground">~{day.estimated_minutes ?? 45} min</p></div></div></div>)}</div>
            </div>

            <aside className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-2 text-primary"><Brain className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">GYMS.LIFE Coach</span></div><h2 className="mt-4 text-2xl font-black">Your program adapts to your context.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">The plan is built from your profile and exercise catalog. The next layer is to feed completed sets, RPE/RIR and readiness back into the orchestrator so future sessions can adapt.</p><div className="mt-6 rounded-2xl bg-muted p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progression</p><p className="mt-2 text-sm font-semibold">{plan.progression || 'Progress gradually while maintaining clean technique.'}</p></div></aside>
          </section>

          {today && <section className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Today's session</p><h2 className="mt-1 text-3xl font-black">{today.title}</h2><p className="mt-2 text-sm text-muted-foreground">{today.focus} · {today.estimated_minutes ?? 45} min</p></div><Link to="/training/active" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground"><Play className="h-4 w-4 fill-current" /> Start</Link></div><div className="grid gap-3 md:grid-cols-2">{(today.exercises ?? []).map((exercise, index) => <div key={`${exercise.slug}-${index}`} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black">{index + 1}</div><div className="min-w-0 flex-1"><p className="font-bold">{exercise.name || exercise.slug}</p><p className="text-xs text-muted-foreground">{exercise.notes || `${exercise.rest_seconds ?? 90}s rest`}</p></div><p className="shrink-0 font-black">{exercise.sets ?? 3} × {exercise.reps || '8–12'}</p></div>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><MiniCard title="Warm-up" text={today.warmup || 'Dynamic warm-up and ramp sets'} icon={<Flame />} /><MiniCard title="Cool-down" text={today.cooldown || 'Light movement and controlled breathing'} icon={<Check />} /></div></section>}
        </>}
      </div>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-border bg-background p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div> }
function MiniCard({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-background p-4"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div> }
function LoadingCard() { return <div className="flex min-h-48 items-center justify-center rounded-[1.75rem] border border-border bg-card text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading your program…</div> }
function EmptyPlan() { return <section className="rounded-[1.75rem] border border-dashed border-border bg-card p-8 text-center sm:p-12"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles /></div><h2 className="mt-5 text-2xl font-black">Your personal program is waiting.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Tell GYMS.LIFE your goal, experience, equipment, schedule and limitations. The AI Coach will build the program around your real context.</p><Link to="/onboarding" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Sparkles className="h-4 w-4" /> Build my program <ArrowRight className="h-4 w-4" /></Link></section> }
