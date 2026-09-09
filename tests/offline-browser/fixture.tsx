/* eslint-disable react-refresh/only-export-components -- isolated executable test entry, not an app module */
import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { LangProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";
import {
  getOfflineQueue,
  queueWorkoutSet,
  flushOfflineWorkoutSets,
  recoverLegacyOfflineSets,
} from "@/lib/offline-store";
import { offlineIdentity } from "@/lib/offline-identity";
import { offlineDatabase } from "@/lib/offline-database";
import { OFFLINE_DB_NAME, LEGACY_OFFLINE_KEYS, type WorkoutSetSync } from "@/lib/offline-contract";
import { switchOwner, syntheticApi, A, B, SA, SB } from "./client";
import "@/styles.css";
localStorage.setItem("forma_lang", new URLSearchParams(location.search).get("lang") ?? "en");
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const own = () => {
  const id = offlineIdentity.current();
  if (!id) throw new Error("Signed out");
  return id;
};
const data = (number: number, weight = 20): WorkoutSetSync => ({
  sessionId: own() === A ? SA : SB,
  exerciseSlug: "squat",
  exerciseName: own() === A ? "Synthetic A squat" : "Synthetic B squat",
  setNumber: number,
  reps: 8,
  weightKg: weight,
  rpe: null,
  done: true,
  performedAt: "2026-09-09T14:00:00.000Z",
});
async function rawRows() {
  return new Promise<unknown[]>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("pending"),
        read = tx.objectStore("pending").getAll();
      read.onsuccess = () => resolve(read.result as unknown[]);
      tx.oncomplete = () => db.close();
    };
  });
}
const api = {
  A,
  B,
  SA,
  SB,
  owner: () => offlineIdentity.current(),
  switchOwner,
  data,
  add: (number: number, weight = 20) => queueWorkoutSet(data(number, weight), own()),
  enqueue: (input: WorkoutSetSync) => queueWorkoutSet(input, own()),
  list: () => getOfflineQueue(own()),
  rawRows,
  flush: () => flushOfflineWorkoutSets(own(), (input) => syntheticApi("sync", input)),
  recover: () => recoverLegacyOfflineSets(own(), (input) => syntheticApi("verify", input)),
  legacy: (text: string, backup?: string) => {
    localStorage.setItem(LEGACY_OFFLINE_KEYS[0], text);
    if (backup !== undefined) localStorage.setItem(LEGACY_OFFLINE_KEYS[1], backup);
    window.dispatchEvent(new StorageEvent("storage", { key: LEGACY_OFFLINE_KEYS[0] }));
  },
  legacyRaw: () => LEGACY_OFFLINE_KEYS.map((key) => localStorage.getItem(key)),
  control: (value: unknown) => syntheticApi("control", value),
  stats: () => syntheticApi("stats", {}),
  close: () => offlineDatabase.close(),
  showStatus: (_show: boolean) => {},
};
Object.assign(window, { __offline: api });
function Shell() {
  const { user, loading } = useAuth(),
    [show, setShow] = useState(false);
  useEffect(() => {
    api.showStatus = setShow;
  }, []);
  return (
    <>
      <h1>Offline acceptance: synthetic accounts, real local database</h1>
      <p data-testid="identity">{loading ? "loading" : (user?.id ?? "signed-out")}</p>
      {show && <OfflineQueueSync />}
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <AuthProvider>
          <main style={{ maxWidth: 900, margin: "auto", padding: 16 }}>
            <Shell />
          </main>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
