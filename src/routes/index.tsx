import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Overview } from "@/components/Overview";
import { FutureLabLanding } from "@/components/FutureLabLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GYMS.LIFE — Tavo asmeninė Future Lab" },
      {
        name: "description",
        content:
          "Tavo treniruotės. Tavo skaitmeninis dvynys. Tavo kitas žingsnis su GYMS.LIFE Future Lab.",
      },
      { property: "og:title", content: "GYMS.LIFE — Tavo asmeninė Future Lab" },
      { property: "og:description", content: "Tavo treniruotės. Tavo skaitmeninis dvynys. Tavo kitas žingsnis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return user ? (
    <AppShell>
      <Overview />
    </AppShell>
  ) : (
    <FutureLabLanding />
  );
}
