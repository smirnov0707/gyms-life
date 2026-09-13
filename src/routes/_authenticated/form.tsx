import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/form")({
  beforeLoad: () => {
    throw redirect({ to: "/ar" });
  },
  component: () => null,
});
