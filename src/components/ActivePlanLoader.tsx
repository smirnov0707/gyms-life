import { useQuery } from "@tanstack/react-query";
import { getActivePlan } from "@/lib/active-plan.functions";
import { GlowCard } from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

type Props = {
  onReady?: (plan: NonNullable<Extract<Awaited<ReturnType<typeof getActivePlan>>, { status: "READY" }>['plan']>) => void;
};

export function ActivePlanLoader({ onReady }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["active-plan"],
    queryFn: () => getActivePlan(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <GlowCard className="panel p-5"><div className="h-5 w-48 animate-pulse rounded bg-muted" /><div className="mt-3 h-3 w-72 animate-pulse rounded bg-muted" /></GlowCard>;
  }

  if (isError) {
    return <GlowCard className="panel p-5"><p className="text-sm text-destructive">Nepavyko įkelti aktyvios programos.</p></GlowCard>;
  }

  if (!data || data.status === "NO_ACTIVE_PLAN") {
    return (
      <GlowCard className="panel p-5">
        <p className="text-sm font-semibold">Aktyvios treniruočių programos dar nėra.</p>
        <p className="mt-1 text-sm text-muted-foreground">Sugeneruok programą, kad galėtum pradėti treniruotę.</p>
        <Button asChild className="mt-4 rounded-full"><Link to="/onboarding">Generuoti programą</Link></Button>
      </GlowCard>
    );
  }

  if (data.status === "INVALID_PLAN") {
    return <GlowCard className="panel p-5"><p className="text-sm font-semibold">Aktyvi programa turi netinkamus duomenis.</p><p className="mt-1 text-sm text-muted-foreground">Programa nebuvo pakeista — ją reikės sugeneruoti iš naujo.</p></GlowCard>;
  }

  onReady?.(data.plan);
  return null;
}
