import { offlineIdentity } from "../../src/lib/offline-identity";
/* eslint-disable react-refresh/only-export-components -- isolated fixture adapter; not a hot-reloaded app module */
import type { ReactNode } from "react";
import { USER } from "./fixtures";
offlineIdentity.set(USER);
const fixtureUser = {
  id: USER,
  email: "core-fixture@example.invalid",
  user_metadata: { full_name: "Synthetic Athlete" },
};
export const useAuth = () => ({
  user: fixtureUser,
  session: null,
  loading: false,
  refresh: async () => true,
});
export const AuthProvider = ({ children }: { children: ReactNode }) => children;
