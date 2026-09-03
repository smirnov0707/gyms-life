import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  clearTrainingRhythm,
  getTrainingRhythm,
  setTrainingRhythm,
} from "@/lib/training-rhythm.functions";
import type { TrainingRhythm, TrainingWeekday } from "@/lib/training-rhythm.schema";

const weekdayOrder: TrainingWeekday[] = [1, 2, 3, 4, 5, 6, 0];

function sortWeekdays(weekdays: TrainingWeekday[]): TrainingWeekday[] {
  return [...weekdays].sort((left, right) => left - right);
}

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  notConfigured: string;
  selected: string;
  save: string;
  saving: string;
  clear: string;
  clearing: string;
  saved: string;
  cleared: string;
  error: string;
  weekday: Record<TrainingWeekday, string>;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "TRAINING RHYTHM",
      title: "Your usual training days",
      description:
        "Choose the days that normally fit your life. This is a soft Today preference, never a restriction—you can train on any day.",
      loading: "Loading your training rhythm…",
      notConfigured: "No usual days are set. Today will keep a neutral schedule preference.",
      selected: "Usual days selected",
      save: "Save rhythm",
      saving: "Saving…",
      clear: "Clear rhythm",
      clearing: "Clearing…",
      saved: "Your training rhythm is updated.",
      cleared: "Your training rhythm is cleared.",
      error: "We couldn't update your training rhythm. Please try again.",
      weekday: { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" },
    };
  }

  return {
    eyebrow: "TRENIRUOČIŲ RITMAS",
    title: "Tavo įprastos treniruočių dienos",
    description:
      "Pasirink dienas, kurios paprastai tinka tavo gyvenimui. Tai švelni Today preferencija, ne apribojimas — treniruotis gali bet kurią dieną.",
    loading: "Įkeliamas tavo treniruočių ritmas…",
    notConfigured: "Įprastos dienos dar nenustatytos. Today naudos neutralų planavimo režimą.",
    selected: "Pasirinktos įprastos dienos",
    save: "Išsaugoti ritmą",
    saving: "Saugoma…",
    clear: "Išvalyti ritmą",
    clearing: "Išvaloma…",
    saved: "Treniruočių ritmas atnaujintas.",
    cleared: "Treniruočių ritmas išvalytas.",
    error: "Nepavyko atnaujinti treniruočių ritmo. Bandyk dar kartą.",
    weekday: { 0: "Sk", 1: "Pr", 2: "An", 3: "Tr", 4: "Kt", 5: "Pn", 6: "Št" },
  };
}

function dispatchTrainingRhythmChanged() {
  window.dispatchEvent(new CustomEvent("gymslife:training-rhythm"));
}

/**
 * A user-owned weekly preference. It intentionally lives apart from browser
 * notification settings, so Today can use one canonical source of truth.
 */
export function TrainingRhythmCard() {
  const { lang } = useI18n();
  const copy = useMemo(() => copyFor(lang), [lang]);
  const loadTrainingRhythm = useServerFn(getTrainingRhythm);
  const saveTrainingRhythm = useServerFn(setTrainingRhythm);
  const removeTrainingRhythm = useServerFn(clearTrainingRhythm);
  const [rhythm, setRhythm] = useState<TrainingRhythm | null>(null);
  const [draft, setDraft] = useState<TrainingWeekday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadTrainingRhythm({});
      setRhythm(result);
      setDraft(result?.preferredWeekdays ?? []);
    } catch {
      toast.error(copy.error);
    } finally {
      setLoading(false);
    }
  }, [copy.error, loadTrainingRhythm]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (weekday: TrainingWeekday) => {
    if (saving || clearing) return;
    setDraft((current) => {
      if (current.includes(weekday)) return current.filter((item) => item !== weekday);
      return sortWeekdays([...current, weekday]);
    });
  };

  const save = async () => {
    if (draft.length === 0 || saving || clearing) return;
    setSaving(true);
    try {
      const result = await saveTrainingRhythm({ data: { preferredWeekdays: draft } });
      setRhythm(result);
      setDraft(result.preferredWeekdays);
      dispatchTrainingRhythmChanged();
      toast.success(copy.saved);
    } catch {
      toast.error(copy.error);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (rhythm === null || saving || clearing) return;
    setClearing(true);
    try {
      await removeTrainingRhythm({ data: {} });
      setRhythm(null);
      setDraft([]);
      dispatchTrainingRhythmChanged();
      toast.success(copy.cleared);
    } catch {
      toast.error(copy.error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="panel p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          {copy.eyebrow}
        </p>
        <h2 className="flex items-center gap-2 text-xl">
          <CalendarDays className="size-5 text-primary" /> {copy.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={copy.title}>
            {weekdayOrder.map((weekday) => {
              const selected = draft.includes(weekday);
              return (
                <Button
                  key={weekday}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="min-h-11 min-w-11 rounded-full px-3"
                  aria-pressed={selected}
                  disabled={saving || clearing}
                  onClick={() => toggle(weekday)}
                >
                  {selected ? <Check className="size-3.5" /> : null}
                  {copy.weekday[weekday]}
                </Button>
              );
            })}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {rhythm === null
              ? copy.notConfigured
              : `${copy.selected}: ${draft.map((day) => copy.weekday[day]).join(", ")}.`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-11 rounded-full px-4"
              disabled={draft.length === 0 || saving || clearing}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {saving ? copy.saving : copy.save}
            </Button>
            {rhythm !== null ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 rounded-full px-4"
                disabled={saving || clearing}
                onClick={() => void clear()}
              >
                {clearing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {clearing ? copy.clearing : copy.clear}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
