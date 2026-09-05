import { createFileRoute } from "@tanstack/react-router";
import { LabView } from "@/components/LabView";

export const Route = createFileRoute("/_authenticated/lab")({
  head: () => ({
    meta: [
      { title: "Laboratorija — GYMS.LIFE" },
      {
        name: "description",
        content: "Realios hipotezės ir naujausi sprendimai su jų įrodymais.",
      },
      { property: "og:title", content: "Laboratorija — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Ką GYMS.LIFE tiria apie tavo treniruotes ir sprendimus.",
      },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <LabView />
    </div>
  );
}
