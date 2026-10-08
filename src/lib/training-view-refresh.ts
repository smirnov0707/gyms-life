import type { QueryClient } from "@tanstack/react-query";
import { OwnerIdSchema } from "./offline-contract";

/** Re-read canonical evidence; never manufacture a second completion or cached result. */
export async function refreshEnduranceQueryCaches(client: QueryClient, ownerId: string) {
  OwnerIdSchema.parse(ownerId);
  await Promise.all(
    ["active-race-prep", "endurance-twin"].map((key) =>
      client.invalidateQueries({ queryKey: [key, ownerId] }),
    ),
  );
}

const todayEvents = [
  "gymslife:life-context",
  "gymslife:training-rhythm",
  "gymslife:adaptation",
  "gymslife:training-completed",
  "gymslife:endurance-updated",
];

/** A new run emits two related events; one tick should cause only one Today read. */
export function subscribeTodayRefresh(target: EventTarget, refresh: () => void): () => void {
  let queued = false;
  let disposed = false;
  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!disposed) refresh();
    });
  };
  for (const event of todayEvents) target.addEventListener(event, schedule);
  return () => {
    disposed = true;
    for (const event of todayEvents) target.removeEventListener(event, schedule);
  };
}
