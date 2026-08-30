import { createFileRoute, redirect } from "@tanstack/react-router";

// The technique scanner now lives inside the camera coach page (/ar).
export const Route = createFileRoute("/_authenticated/form")({
  beforeLoad: () => {
    throw redirect({ to: "/ar" });
  },
});
