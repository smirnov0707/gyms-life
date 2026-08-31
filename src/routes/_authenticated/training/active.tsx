import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Check, ChevronLeft, Clock3, Dumbbell, Pause, Play, RotateCcw, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated/training/active')({ component: ActiveWorkoutPage })

type Exercise = { name: string; slug?: string; sets?: number; reps?: number | string; rest?: number; notes?: string }

type Session = { id: string; started_at: string }

const fallbackExercises: Exercise[] = [
  { name: 'Squat', sets: 4, reps: 8, rest: 120 },
  { name: 'Romanian Deadlift', sets: 3, reps: 10, rest: 90 },
  { name: 'Bench Press', sets: 4, reps: 8, rest: 120 },
  { name: 'Cable Row', sets: 3, reps: 10, rest: 90 },
]

function ActiveWorkoutPage() {
  const navigate = useNavigate()
  const [planId, setPlanId] = useState<string | null>(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [title, setTitle] = useState('Today’s Workout')
  const [exercises, setExercises] = useState<Exercise[]>(fallbackExercises)
  const [session, setSession] = useState<Session | null>(null)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [setIndex, setSetIndex] = useState(0)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [rest, setRest] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const exercise = exercises[exerciseIndex]
  const totalSets = Math.max(1, Number(exercise?.sets) || 1)
  const progress = useMemo(() => Math.round(((exerciseIndex + setIndex / totalSets) / Math.max(1, exercises.length)) * 100), [exerciseIndex, setIndex, totalSets, exercises.length])

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase.from('plans').select('id,title,data').eq('user_id', user.id).eq('is_active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (!data || !mounted) return
      setPlanId(data.id)
      const raw = (data.data ?? {}) as any
      const days = Array.isArray(raw.days) ? raw.days : Array.isArray(raw.workouts) ? raw.workouts : []
      const today = days[0] ?? {}
      const list = Array.isArray(today.exercises) ? today.exercises : []
      setTitle(today.title ?? data.title ?? 'Today’s Workout')
      if (list.length) setExercises(list)
      setDayIndex(Number(today.day_index ?? 0))
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!session) return
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [session])

  useEffect(() => {
    if (rest <= 0) return
    const id = window.setInterval(() => setRest(v => Math.max(0, v - 1)), 1000)
    return () => window.clearInterval(id)
  }, [rest])

  async function start() {
    setBusy(true); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('Please sign in to start a workout.'); setBusy(false); return }
    const { data, error } = await supabase.from('workout_sessions').insert({ user_id: user.id, plan_id: planId, day_index: dayIndex, title }).select('id,started_at').single()
    if (error) setMessage(error.message); else setSession(data as Session)
    setBusy(false)
  }

  async function logSet() {
    if (!session || !exercise) return
    setBusy(true); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); return }
    const payload = { user_id: user.id, session_id: session.id, exercise_slug: exercise.slug ?? exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), exercise_name: exercise.name, set_number: setIndex + 1, reps: Number(reps) || Number(exercise.reps) || null, weight_kg: weight === '' ? null : Number(weight), rpe: rpe === '' ? null : Number(rpe), done: true }
    const { error } = await supabase.from('set_logs').insert(payload)
    if (error) { setMessage(error.message); setBusy(false); return }
    setRest(Number(exercise.rest) || 90)
    setReps(''); setRpe('')
    if (setIndex + 1 < totalSets) setSetIndex(v => v + 1)
    else if (exerciseIndex + 1 < exercises.length) { setExerciseIndex(v => v + 1); setSetIndex(0); setWeight('') }
    else await finish()
    setBusy(false)
  }

  async function finish() {
    if (!session) return
    const { data: logs } = await supabase.from('set_logs').select('reps,weight_kg').eq('session_id', session.id)
    const volume = (logs ?? []).reduce((sum, x) => sum + Number(x.reps ?? 0) * Number(x.weight_kg ?? 0), 0)
    const duration = Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000))
    await supabase.from('workout_sessions').update({ finished_at: new Date().toISOString(), duration_seconds: duration, total_volume: volume }).eq('id', session.id)
    navigate({ to: '/progress' })
  }

  if (!session) return <main className="min-h-screen bg-background px-4 py-6 text-foreground"><div className="mx-auto max-w-4xl space-y-6"><Link to="/training" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Back to Training</Link><section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Ready when you are</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">{title}</h1><p className="mt-3 text-muted-foreground">{exercises.length} exercises · {exercises.reduce((n, e) => n + (Number(e.sets) || 1), 0)} working sets</p><button onClick={start} disabled={busy} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 font-black text-primary-foreground disabled:opacity-50"><Play className="h-5 w-5 fill-current" /> Start workout</button>{message && <p className="mt-4 text-sm text-destructive">{message}</p>}</section></div></main>

  return <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6"><div className="mx-auto max-w-5xl space-y-4"><header className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Active workout</p><h1 className="text-2xl font-black">{title}</h1></div><div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold"><Clock3 className="h-4 w-4 text-primary" /> {formatTime(seconds)}</div></header><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progress)}%` }} /></div><section className="rounded-[2rem] border border-border bg-card p-6 sm:p-10"><div className="flex items-center justify-between gap-4"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Exercise {exerciseIndex + 1} / {exercises.length}</span><span className="text-sm font-semibold text-muted-foreground">Set {setIndex + 1} / {totalSets}</span></div><h2 className="mt-6 text-4xl font-black">{exercise.name}</h2><p className="mt-2 text-muted-foreground">Target: {exercise.reps ?? '—'} reps · {exercise.rest ?? 90}s rest</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><Field label="Weight (kg)" value={weight} onChange={setWeight} /><Field label="Reps" value={reps} onChange={setReps} placeholder={String(exercise.reps ?? '')} /><Field label="RPE" value={rpe} onChange={setRpe} placeholder="7–10" /></div><div className="mt-6 flex flex-wrap gap-3"><button onClick={logSet} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground disabled:opacity-50"><Check className="h-5 w-5" /> Log set</button><button onClick={() => setRest(Number(exercise.rest) || 90)} className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-bold"><RotateCcw className="h-4 w-4" /> Rest</button>{rest > 0 && <div className="inline-flex items-center gap-2 rounded-xl bg-muted px-5 py-3 font-black"><Pause className="h-4 w-4" /> {formatTime(rest)}</div>}</div>{message && <p className="mt-4 text-sm text-destructive">{message}</p>}</section><div className="grid gap-3 sm:grid-cols-3"><Info icon={<Dumbbell />} label="Current set" value={`${setIndex + 1} / ${totalSets}`} /><Info icon={<Trophy />} label="Progress" value={`${Math.min(100, progress)}%`} /><Info icon={<Clock3 />} label="Elapsed" value={formatTime(seconds)} /></div></div></main>
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input inputMode="decimal" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg font-bold outline-none ring-primary/30 focus:ring-2" /></label> }
function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="text-xs text-muted-foreground">{label}</p><p className="font-black">{value}</p></div> }
function formatTime(total: number) { const m = Math.floor(total / 60).toString().padStart(2, '0'); const s = Math.floor(total % 60).toString().padStart(2, '0'); return `${m}:${s}` }
