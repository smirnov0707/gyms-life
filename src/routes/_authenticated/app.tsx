import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/Overview";
import { TwinHome } from "@/components/twin/TwinHome";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Apžvalga — GYMS.LIFE treniruočių planas" },
      {
        name: "description",
        content: "Tavo šios dienos treniruotė, savaitės planas ir statistika.",
      },
      { property: "og:title", content: "Apžvalga — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Šios dienos treniruotė ir progresas vienoje vietoje.",
      },
    ],
  }),
  component: TodayPage,
});

/**
 * The Twin is the screen, and everything else is below it.
 *
 * It used to be one card among a dozen on Today, roughly a third of the way
 * down. The body is what this app is for: it opens on the figure, at the size
 * of the screen, carrying what the session asks of it and what it has not
 * finished recovering from. The rest of Today — signals, the plan, the brief,
 * the sources — keeps its place under it rather than being taken away.
 */
function TodayPage() {
  return (
    <div className="grid gap-4">
      <TwinHome />
      <Overview />
    </div>
  );
}
