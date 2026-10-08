import { offlineIdentity } from "../../src/lib/offline-identity";
/* eslint-disable react-refresh/only-export-components -- isolated fixture adapter; not a hot-reloaded app module */
import { useSyncExternalStore, type ReactNode } from "react";
import { USER } from "./fixtures";
offlineIdentity.set(USER);
let ownerId = USER;
const listeners = new Set<() => void>();
const userFor = (id: string) => ({
  id,
  email: "core-fixture@example.invalid",
  user_metadata: { full_name: "Synthetic Athlete" },
});
const users = new Map([[USER, userFor(USER)]]);
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const snapshot = () => ownerId;
Object.assign(window, {
  __submissionAuth: {
    setOwner(id: string) {
      offlineIdentity.set(id);
      ownerId = id;
      if (!users.has(id)) users.set(id, userFor(id));
      for (const notify of listeners) notify();
    },
  },
});
export const useAuth = () => {
  const id = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { user: users.get(id)!, session: null, loading: false, refresh: async () => true };
};
export const AuthProvider = ({ children }: { children: ReactNode }) => children;
