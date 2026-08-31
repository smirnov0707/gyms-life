import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { RelatedLinks } from "@/components/RelatedLinks";
import { RELATED } from "@/lib/nav-map";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProgramActivationActions } from "@/components/ProgramActivationActions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(false);
  const [draftPlanId, setDraftPlanId] = useState<string | null>(null);
  const [activationDone, setActivationDone] = useState(false);
  const workoutPath = pathname.startsWith("/workout/");

  useEffect(() => {
    if (loading || user) return;
    let active = true;
    setChecking(true);
    (async () => {
      const has = await refresh();
      if (!active) return;
      setChecking(false);
      if (!has) navigate({ to: "/auth" });
    })();
    return () => {
      active = false;
    };
  }, [user, loading, refresh, navigate]);

  useEffect(() => {
    if (!user || !workoutPath || activationDone) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setDraftPlanId(data?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, [user, workoutPath, activationDone]);

  if (loading || checking || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const activationGate = workoutPath && draftPlanId && !activationDone;

  return (
    <AppShell>
      <AccessGate>
        {activationGate ? (
          <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
            <div className="panel w-full p-8 text-center md:p-10">
              <ShieldCheck className="mx-auto size-12 text-primary" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">GYMS.LIFE PROGRAM</p>
              <h1 className="mt-3 text-4xl font-bold">Activate your program</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Review the generated program first. Activation makes it your current training program and enables the workout flow.
              </p>
              <div className="mt-7 flex justify-center">
                <ProgramActivationActions
                  planId={draftPlanId}
                  lang="lt"
                  onActivated={() => setActivationDone(true)}
                />
              </div>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
        <RelatedForRoute />
      </AccessGate>
    </AppShell>
  );
}

/** Cross-feature links rendered under every authenticated page. */
function RelatedForRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = Object.keys(RELATED).find((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!base) return null;
  return <RelatedLinks from={base} />;
}
