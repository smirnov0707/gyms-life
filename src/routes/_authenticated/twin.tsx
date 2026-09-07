import { createFileRoute } from "@tanstack/react-router";
import { TwinScreen } from "@/components/twin/TwinScreen";

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
  return <TwinScreen />;
}
