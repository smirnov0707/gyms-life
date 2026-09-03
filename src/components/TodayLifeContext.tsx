import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Loader2, MapPin, ShieldAlert, Sparkles, Trash2, Waves } from "lucide-react";
import { toast } from "sonner";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  dismissActiveLifeContext,
  getActiveLifeContexts,
  setActiveLifeContext,
} from "@/lib/life-context.functions";
import type { ActiveLifeContext, LifeContextInput } from "@/lib/life-context.schema";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  saveFailed: string;
  dismissFailed: string;
  remove: string;
  actions: Array<{ label: string; input: LifeContextInput; icon: typeof Clock3 }>;
  active: (context: ActiveLifeContext) => string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "REAL LIFE CONTEXT",
      title: "What is different today?",
      description: "Tell GYMS.LIFE once. It will remain active only for the relevant time.",
      loading: "Loading your current context…",
      saveFailed: "We couldn't save that context. Please try again.",
      dismissFailed: "We couldn't clear that context. Please try again.",
      remove: "Remove current context",
      actions: [
        { label: "Traveling", input: { kind: "travel", durationHours: 24 * 7 }, icon: MapPin },
        {
          label: "30 min today",
          input: { kind: "time_limited", durationHours: 12, timeAvailableMinutes: 30 },
          icon: Clock3,
        },
        { label: "Gym closed", input: { kind: "facility_closed", durationHours: 24 }, icon: Waves },
        {
          label: "Stressful week",
          input: { kind: "high_stress", durationHours: 24 * 7 },
          icon: Sparkles,
        },
        {
          label: "Temporary limitation",
          input: { kind: "temporary_limitation", durationHours: 72 },
          icon: ShieldAlert,
        },
      ],
      active: (context) => {
        if (context.context.kind === "time_limited") {
          return `Up to ${context.context.minutes} min available`;
        }
        return context.context.kind.replaceAll("_", " ");
      },
    };
  }

  return {
    eyebrow: "GYVENIMO KONTEKSTAS",
    title: "Kas šiandien kitaip?",
    description: "Pasakyk GYMS.LIFE vieną kartą. Kontekstas galios tik tiek, kiek reikia.",
    loading: "Įkeliamas dabartinis kontekstas…",
    saveFailed: "Nepavyko išsaugoti konteksto. Bandyk dar kartą.",
    dismissFailed: "Nepavyko pašalinti konteksto. Bandyk dar kartą.",
    remove: "Pašalinti dabartinį kontekstą",
    actions: [
      { label: "Keliauju", input: { kind: "travel", durationHours: 24 * 7 }, icon: MapPin },
      {
        label: "Turiu 30 min.",
        input: { kind: "time_limited", durationHours: 12, timeAvailableMinutes: 30 },
        icon: Clock3,
      },
      {
        label: "Salė uždaryta",
        input: { kind: "facility_closed", durationHours: 24 },
        icon: Waves,
      },
      {
        label: "Įtempta savaitė",
        input: { kind: "high_stress", durationHours: 24 * 7 },
        icon: Sparkles,
      },
      {
        label: "Laikinas apribojimas",
        input: { kind: "temporary_limitation", durationHours: 72 },
        icon: ShieldAlert,
      },
    ],
    active: (context) => {
      if (context.context.kind === "time_limited") {
        return `Turiu iki ${context.context.minutes} min.`;
      }
      const labels: Record<ActiveLifeContext["context"]["kind"], string> = {
        travel: "Keliaujate",
        time_limited: "Ribotas laikas",
        equipment_limited: "Ribota įranga",
        facility_closed: "Salė uždaryta",
        high_stress: "Įtempta savaitė",
        temporary_limitation: "Laikinas apribojimas",
      };
      return labels[context.context.kind];
    },
  };
}

function notifyContextChanged() {
  window.dispatchEvent(new CustomEvent("gymslife:life-context"));
}

/** Short, user-controlled current-state inputs for the canonical Today decision. */
export function TodayLifeContext() {
  const { lang } = useI18n();
  const copy = useMemo(() => copyFor(lang), [lang]);
  const getContexts = useServerFn(getActiveLifeContexts);
  const setContext = useServerFn(setActiveLifeContext);
  const dismissContext = useServerFn(dismissActiveLifeContext);
  const [contexts, setContexts] = useState<ActiveLifeContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKind, setPendingKind] = useState<LifeContextInput["kind"] | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContexts(await getContexts({}));
    } catch {
      setContexts([]);
    } finally {
      setLoading(false);
    }
  }, [getContexts]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (input: LifeContextInput) => {
    if (pendingKind !== null || dismissingId !== null) return;
    setPendingKind(input.kind);
    try {
      await setContext({ data: input });
      await load();
      notifyContextChanged();
    } catch {
      toast.error(copy.saveFailed);
    } finally {
      setPendingKind(null);
    }
  };

  const dismiss = async (contextId: string) => {
    if (pendingKind !== null || dismissingId !== null) return;
    setDismissingId(contextId);
    try {
      await dismissContext({ data: { contextId } });
      setContexts((current) => current.filter((context) => context.id !== contextId));
      notifyContextChanged();
    } catch {
      toast.error(copy.dismissFailed);
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <GlowCard className="panel p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          {copy.eyebrow}
        </p>
        <h2 className="text-xl md:text-2xl">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      ) : (
        <>
          {contexts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {contexts.map((context) => (
                <span
                  key={context.id}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-foreground"
                >
                  {copy.active(context)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full hover:bg-background/80"
                    aria-label={copy.remove}
                    disabled={dismissingId === context.id}
                    onClick={() => void dismiss(context.id)}
                  >
                    {dismissingId === context.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {copy.actions.map(({ label, input, icon: Icon }) => (
              <Button
                key={input.kind}
                type="button"
                variant={input.kind === "temporary_limitation" ? "outline" : "secondary"}
                className="min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold"
                disabled={pendingKind !== null || dismissingId !== null}
                onClick={() => void activate(input)}
              >
                {pendingKind === input.kind ? <Loader2 className="animate-spin" /> : <Icon />}
                {label}
              </Button>
            ))}
          </div>
        </>
      )}
    </GlowCard>
  );
}
