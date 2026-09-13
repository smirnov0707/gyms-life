import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reminders")({
  beforeLoad: () => {
    throw redirect({ to: "/me" });
  },
  component: () => null,
});
