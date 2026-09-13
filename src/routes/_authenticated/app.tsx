import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/Overview";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Today — GYMS.LIFE" },
      {
        name: "description",
        content:
          "Vienas aiškus dienos sprendimas, paremtas tavo būsena, istorija ir patvirtintais duomenimis.",
      },
      { property: "og:title", content: "Today — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Ką daryti dabar — ir kodėl sistema taip nusprendė.",
      },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  return <Overview />;
}
