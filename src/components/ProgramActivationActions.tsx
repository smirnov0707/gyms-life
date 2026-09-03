import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
  const [activating, setActivating] = useState(false);
  const [active, setActive] = useState(false);

  const handleActivate = async () => {
    if (!planId || activating) return;
    setActivating(true);
    try {
      await activate({ data: { planId } });
      setActive(true);
      onActivated?.();
      toast.success(lang === "lt" ? "Programa aktyvuota" : "Program activated");
    } catch (error) {
      toast.error(
        errorMessage(error, lang === "lt" ? "Nepavyko aktyvuoti programos" : "Activation failed"),
      );
    } finally {
      setActivating(false);
    }
  };

  if (active) {
    return (
      <Button asChild size="lg" className="hard-shadow rounded-none px-8 font-bold">
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
      className="hard-shadow rounded-none px-8 font-bold"
    >
      <ShieldCheck className="mr-1 size-4" />
      {activating ? (lang === "lt" ? "Aktyvuojama…" : "Activating…") : "Activate Program"}
    </Button>
  );
}
