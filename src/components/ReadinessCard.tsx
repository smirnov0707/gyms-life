import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/error-message";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { applyAdaptation, loadModifierFor } from "@/lib/readiness-adapt";

const COPY = {
  lt: {
    readiness: "Pasiruošimas",
    tune: "Koreguoti",
    hide: "Slėpti",
    how: "Kaip jautiesi dabar?",
    save: "Išsaugoti",
    saved: "Pasiruošimas atnaujintas",
    saveFailed: "Nepavyko atnaujinti pasiruošimo",
    load: "Rekomenduojamas krūvis",
    hint: {
      high: "Galima kelti svorį arba pridėti seriją.",
      mid: "Laikykis plano, bet stebėk techniką.",
      low: "Sumažink apimtį ir palik 2–3 kartojimų atsargą.",
    },
    labels: ["Išsekęs", "Pavargęs", "Normaliai", "Gerai", "Kaip nauja"],
  },
  en: {
    readiness: "Readiness",
    tune: "Adjust",
    hide: "Hide",
    how: "How do you feel right now?",
    save: "Save",
    saved: "Readiness updated",
    saveFailed: "Could not update readiness",
    load: "Recommended load",
    hint: {
      high: "You can add weight or an extra set.",
      mid: "Stick to the plan, keep technique tight.",
      low: "Cut volume and leave 2–3 reps in reserve.",
    },
    labels: ["Drained", "Tired", "Normal", "Good", "Fresh"],
  },
} as const;

export interface ReadinessCardProps {
  score: number;
  state: string | null;
  ring: React.ReactNode;
}

/** Interactive readiness card: shows the score, what it means for load, and lets the athlete re-tune it. */
export const ReadinessCard: React.FC<ReadinessCardProps> = ({ score, state, ring }) => {
  const { lang } = useI18n();
  const c = COPY[lang === "lt" ? "lt" : "en"];
  const { user } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(score);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(score), [score]);

  const modifier = useMemo(() => loadModifierFor(value), [value]);
  const hint = value >= 80 ? c.hint.high : value >= 55 ? c.hint.mid : c.hint.low;
  const label = c.labels[Math.min(4, Math.max(0, Math.floor(value / 20)))];

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing, error: existingError } = await supabase
        .from("daily_checkins")
        .select("id")
        .eq("user_id", user.id)
        .eq("checkin_on", today)
        .maybeSingle();
      if (existingError) throw existingError;

      const payload = { readiness_score: Math.round(value), load_modifier: modifier };
      const { error } = existing?.id
        ? await supabase.from("daily_checkins").update(payload).eq("id", existing.id)
        : await supabase
            .from("daily_checkins")
            .insert({ user_id: user.id, checkin_on: today, ...payload });
      if (error) throw error;

      applyAdaptation(modifier);
      await qc.invalidateQueries({ queryKey: ["today-checkin", user.id] });
      toast.success(`${c.saved} · ${Math.round(modifier * 100)}%`);
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, c.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel w-full min-w-[16rem] p-4 md:w-auto">
      <div className="flex items-center gap-4">
        {ring}
        <div className="flex-1 text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {c.readiness}
          </p>
          <p className="text-display text-2xl text-primary">
            {score}
            <span className="ml-1 text-sm text-muted-foreground">/100</span>
          </p>
          <p className="text-sm font-bold text-foreground">{state}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{c.load}</span>
        <span className="font-mono text-sm font-bold text-primary">
          {Math.round(loadModifierFor(score) * 100)}%
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{hint}</p>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 w-full rounded-xl text-xs"
      >
        <SlidersHorizontal className="mr-1.5 size-3.5" /> {open ? c.hide : c.tune}
      </Button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-[11px] font-semibold">{c.how}</p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            aria-label={c.how}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{label}</span>
            <span className="font-mono">
              {value}/100 · {Math.round(modifier * 100)}%
            </span>
          </div>
          <Button onClick={save} disabled={saving} size="sm" className="w-full rounded-xl">
            {saving ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            {c.save}
          </Button>
        </div>
      )}
    </div>
  );
};
