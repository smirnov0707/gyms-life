import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/coach-history")({
  beforeLoad: () => {
    throw redirect({ to: "/coach" });
  },
  component: () => null,
});
