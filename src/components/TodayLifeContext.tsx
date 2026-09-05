import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Clock3,
  Dumbbell,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
  Trash2,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { baseLang, useI18n, type Lang } from "@/lib/i18n";
import {
  dismissActiveLifeContext,
  getActiveLifeContexts,
  setActiveLifeContext,
} from "@/lib/life-context.functions";
import type { ActiveLifeContext, LifeContextInput } from "@/lib/life-context.schema";
import { TemporaryEquipmentChoices, type WorkoutEquipment } from "@/lib/workout-equipment.schema";

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  saveFailed: string;
  dismissFailed: string;
  remove: string;
  equipment: {
    action: string;
    dialogTitle: string;
    dialogDescription: string;
    save: string;
    cancel: string;
    names: Record<WorkoutEquipment, string>;
  };
  actions: Array<{ label: string; input: LifeContextInput; icon: typeof Clock3 }>;
  active: (context: ActiveLifeContext) => string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    const equipmentNames: Record<WorkoutEquipment, string> = {
      bodyweight: "Bodyweight",
      barbell: "Barbell",
      dumbbell: "Dumbbells",
      kettlebell: "Kettlebells",
      band: "Resistance bands",
      machine: "Machines",
      cable: "Cable station",
      pullup_bar: "Pull-up bar",
      trx: "TRX",
      ball: "Exercise ball",
      cardio: "Cardio equipment",
      other: "Other equipment",
    };
    return {
      eyebrow: "REAL LIFE CONTEXT",
      title: "What is different today?",
      description: "Tell GYMS.LIFE once. It will remain active only for the relevant time.",
      loading: "Loading your current context…",
      saveFailed: "We couldn't save that context. Please try again.",
      dismissFailed: "We couldn't clear that context. Please try again.",
      remove: "Remove current context",
      equipment: {
        action: "Available equipment",
        dialogTitle: "What equipment is available today?",
        dialogDescription:
          "GYMS.LIFE will adapt only with exercises that match this equipment. This context expires in 24 hours.",
        save: "Apply available equipment",
        cancel: "Cancel",
        names: equipmentNames,
      },
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
        if (context.context.kind === "equipment_limited") {
          return `Available: ${context.context.equipment
            .map((item) => equipmentNames[item])
            .join(", ")}`;
        }
        return context.context.kind.replaceAll("_", " ");
      },
    };
  }

  const equipmentNames: Record<WorkoutEquipment, string> = {
    bodyweight: "Kūno svoris",
    barbell: "Štanga",
    dumbbell: "Hanteliai",
    kettlebell: "Svarsčiai",
    band: "Gumos",
    machine: "Treniruokliai",
    cable: "Skriemuliai",
    pullup_bar: "Skersinis",
    trx: "TRX",
    ball: "Kamuolys",
    cardio: "Kardio įranga",
    other: "Kita įranga",
  };
  return {
    eyebrow: "GYVENIMO KONTEKSTAS",
    title: "Kas šiandien kitaip?",
    description: "Pasakyk GYMS.LIFE vieną kartą. Kontekstas galios tik tiek, kiek reikia.",
    loading: "Įkeliamas dabartinis kontekstas…",
    saveFailed: "Nepavyko išsaugoti konteksto. Bandyk dar kartą.",
    dismissFailed: "Nepavyko pašalinti konteksto. Bandyk dar kartą.",
    remove: "Pašalinti dabartinį kontekstą",
    equipment: {
      action: "Turiu kitą įrangą",
      dialogTitle: "Kokia įranga šiandien prieinama?",
      dialogDescription:
        "GYMS.LIFE keis planą tik į pratimus, kuriems ši įranga tinka. Kontekstas baigs galioti po 24 val.",
      save: "Pritaikyti pagal įrangą",
      cancel: "Atšaukti",
      names: equipmentNames,
    },
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
      if (context.context.kind === "equipment_limited") {
        return `Prieinama: ${context.context.equipment
          .map((item) => equipmentNames[item])
          .join(", ")}`;
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
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState<WorkoutEquipment[]>(["bodyweight"]);

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

  const activate = async (input: LifeContextInput): Promise<boolean> => {
    if (pendingKind !== null || dismissingId !== null) return false;
    setPendingKind(input.kind);
    try {
      await setContext({ data: input });
      await load();
      notifyContextChanged();
      return true;
    } catch {
      toast.error(copy.saveFailed);
      return false;
    } finally {
      setPendingKind(null);
    }
  };

  const openEquipmentDialog = () => {
    const activeEquipment = contexts.find(
      (
        context,
      ): context is ActiveLifeContext & {
        context: { kind: "equipment_limited"; equipment: WorkoutEquipment[] };
      } => context.context.kind === "equipment_limited",
    );
    setAvailableEquipment(activeEquipment?.context.equipment ?? ["bodyweight"]);
    setEquipmentDialogOpen(true);
  };

  const toggleEquipment = (equipment: WorkoutEquipment) => {
    setAvailableEquipment((current) => {
      if (!current.includes(equipment)) return [...current, equipment];
      return current.length === 1 ? current : current.filter((item) => item !== equipment);
    });
  };

  const saveAvailableEquipment = async () => {
    const saved = await activate({
      kind: "equipment_limited",
      durationHours: 24,
      availableEquipment,
    });
    if (saved) setEquipmentDialogOpen(false);
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
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold"
              disabled={pendingKind !== null || dismissingId !== null}
              onClick={openEquipmentDialog}
            >
              <Dumbbell />
              {copy.equipment.action}
            </Button>
          </div>

          <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-border bg-surface p-5 sm:max-w-md sm:p-6">
              <DialogHeader>
                <DialogTitle>{copy.equipment.dialogTitle}</DialogTitle>
                <DialogDescription>{copy.equipment.dialogDescription}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2" role="group">
                {TemporaryEquipmentChoices.map((equipment) => {
                  const selected = availableEquipment.includes(equipment);
                  return (
                    <Button
                      key={equipment}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="min-h-12 justify-start gap-2 rounded-2xl px-3 text-left text-sm"
                      aria-pressed={selected}
                      disabled={pendingKind !== null}
                      onClick={() => toggleEquipment(equipment)}
                    >
                      {selected ? <Check className="size-4" /> : <Dumbbell className="size-4" />}
                      {copy.equipment.names[equipment]}
                    </Button>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pendingKind !== null}
                  onClick={() => setEquipmentDialogOpen(false)}
                >
                  {copy.equipment.cancel}
                </Button>
                <Button
                  type="button"
                  disabled={pendingKind !== null}
                  onClick={() => void saveAvailableEquipment()}
                >
                  {pendingKind === "equipment_limited" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Dumbbell />
                  )}
                  {copy.equipment.save}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </GlowCard>
  );
}
