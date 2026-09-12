import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AccessGate } from "@/components/AccessGate";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";
import { ProfileTimeZoneSync } from "@/components/ProfileTimeZoneSync";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

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

  if (loading || checking || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <ProfileTimeZoneSync userId={user.id} />
      <OfflineQueueSync key={user.id} />
      <AppShell key={user.id}>
        <AccessGate>
          <Outlet />
        </AccessGate>
      </AppShell>
    </>
  );
}
