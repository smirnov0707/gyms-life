import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/history")({
  beforeLoad: () => {
    throw redirect({ to: "/twin", search: { view: "journal" } });
  },
  component: () => null,
});
