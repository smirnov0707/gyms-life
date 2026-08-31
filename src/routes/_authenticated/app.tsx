import { createFileRoute } from "@tanstack/react-router";
import { PremiumDashboard } from "@/components/PremiumDashboard";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Apžvalga — GYMS.LIFE treniruočių planas" },
      { name: "description", content: "Tavo šios dienos treniruotė, savaitės planas ir statistika." },
      { property: "og:title", content: "Apžvalga — GYMS.LIFE" },
      { property: "og:description", content: "Šios dienos treniruotė ir progresas vienoje vietoje." },
    ],
  }),
  component: PremiumDashboard,
});
