import { createFileRoute } from "@tanstack/react-router";
import { TwinScreen } from "@/components/twin/TwinScreen";
import { parseTwinNavigation } from "@/lib/twin-navigation";

export const Route = createFileRoute("/_authenticated/twin")({
  head: () => ({
    meta: [
      { title: "My Twin — GYMS.LIFE" },
      {
        name: "description",
        content: "Gyvas tavo kūno, sistemų, istorijos ir ateities modelis vienoje vietoje.",
      },
      { property: "og:title", content: "My Twin — GYMS.LIFE" },
      {
        property: "og:description",
        content: "Tavo būsenos, pokyčių ir scenarijų vaizdas per laiką.",
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
