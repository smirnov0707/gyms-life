import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Overview } from "@/components/Overview";
import { FutureLabLanding } from "@/components/FutureLabLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GYMS.LIFE — Your personal Future Lab" },
      {
        name: "description",
        content:
          "Bring your training, Digital Twin, insights and AI coach together. Build a routine, record your sessions and explore your progress with GYMS.LIFE.",
      },
      { property: "og:title", content: "GYMS.LIFE — Your personal Future Lab" },
      { property: "og:description", content: "Your training. Your Digital Twin. Your next step." },
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
