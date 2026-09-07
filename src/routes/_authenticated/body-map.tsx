import { createFileRoute } from "@tanstack/react-router";
import { FutureLabBodyMap } from "@/components/future-lab/FutureLabBodyMap";

export const Route = createFileRoute("/_authenticated/body-map")({
  head: () => ({
    meta: [
      { title: "Body Map — GYMS.LIFE FUTURE LAB" },
      {
        name: "description",
        content: "Inspect calculated Digital Twin recovery and recorded load by body region.",
      },
    ],
  }),
  component: BodyMapPage,
});

function BodyMapPage() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <FutureLabBodyMap />
    </div>
  );
}
