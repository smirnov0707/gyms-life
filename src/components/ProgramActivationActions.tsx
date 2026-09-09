import { useQueryClient } from "@tanstack/react-query";
import { refreshCoreData } from "@/lib/core-cache";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { activatePlan } from "@/lib/activate-plan.functions";
import { errorMessage } from "@/lib/error-message";
import type { SupportedLanguage } from "@/lib/language.schema";

export function ProgramActivationActions({
  planId,
  lang,
  onActivated,
}: {
  planId: string;
  lang: SupportedLanguage;
  onActivated?: () => void;
}) {
  const activate = useServerFn(activatePlan);
  const queryClient = useQueryClient();
  const lock = useRef(false);
  const [activating, setActivating] = useState(false);
  const [activatedId, setActivatedId] = useState<string | null>(null);
  const active = activatedId === planId;

  const handleActivate = async () => {
    if (!planId || lock.current) return;
    lock.current = true;
    setActivating(true);
    try {
      await activate({ data: { planId } });
      setActivatedId(planId);
      await refreshCoreData(queryClient, "training");
      onActivated?.();
      toast.success(lang === "lt" ? "Programa aktyvuota" : "Program activated");
    } catch (error) {
      const issue = error instanceof Error ? error.message : "";
      if (issue.includes("TRAINING_PLAN_OPEN_WORKOUT")) {
        toast.error(
          lang === "lt"
            ? "Pirma užbaik pradėtą treniruotę, tada keisk programą."
            : "Finish the workout already in progress before switching programmes.",
        );
        return;
      }
      if (issue.includes("TRAINING_PLAN_INVALID")) {
        toast.error(
          lang === "lt"
            ? "Šio plano duomenys netinkami. Sukurk naują programą."
            : "This stored programme is invalid. Build a new programme.",
        );
        return;
      }
      toast.error(
        errorMessage(error, lang === "lt" ? "Nepavyko aktyvuoti programos" : "Activation failed"),
      );
    } finally {
      lock.current = false;
      setActivating(false);
    }
  };

  if (active) {
    return (
      <Button
        asChild
        size="lg"
        className="hard-shadow h-auto max-w-full whitespace-normal rounded-none px-4 py-3 font-bold"
      >
        <Link to="/app">
          {lang === "lt" ? "Atidaryti šiandienos sprendimą" : "Open today's decision"}
          <ArrowRight className="ml-1 size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      onClick={handleActivate}
      disabled={activating}
      className="hard-shadow h-auto max-w-full whitespace-normal rounded-none px-4 py-3 font-bold"
    >
      <ShieldCheck className="mr-1 size-4" />
      {activating
        ? lang === "lt"
          ? "Aktyvuojama…"
          : "Activating…"
        : lang === "lt"
          ? "Aktyvuoti programą"
          : "Activate program"}
    </Button>
  );
}
