import { createFileRoute } from "@tanstack/react-router";
import { TwinView } from "@/components/TwinView";

export const Route = createFileRoute("/_authenticated/twin")({
  head: () => ({
    meta: [
      { title: "Skaitmeninis dvynys — GYMS.LIFE" },
      {
        name: "description",
        content: "Apskaičiuotas atsistatymas kiekvienam kūno regionui pagal tavo treniruotes.",
      },
      { property: "og:title", content: "Dvynys — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Tavo kūno regionų krūvis ir atsistatymas realiu laiku.",
      },
    ],
  }),
  component: TwinPage,
});

function TwinPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <TwinView />
    </div>
  );
}
