import { createFileRoute } from "@tanstack/react-router";
import { TwinView } from "@/components/TwinView";
import { TwinRewind } from "@/components/twin/TwinRewind";
import { TwinTimeline } from "@/components/twin/TwinTimeline";
import { TwinTrendLens } from "@/components/twin/TwinTrendLens";

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
    <div className="mx-auto w-full max-w-6xl">
      <TwinView />
      <TwinRewind />
      <TwinTrendLens />
      <TwinTimeline />
    </div>
  );
}
