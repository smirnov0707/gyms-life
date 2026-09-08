import { createFileRoute } from "@tanstack/react-router";
import { TwinScreen } from "@/components/twin/TwinScreen";
import { parseTwinNavigation } from "@/lib/twin-navigation";

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
  validateSearch: parseTwinNavigation,
  component: TwinPage,
});

function TwinPage() {
  const navigation = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <TwinScreen
      navigation={navigation}
      onNavigate={(search) => {
        void navigate({ search, resetScroll: false });
      }}
    />
  );
}
