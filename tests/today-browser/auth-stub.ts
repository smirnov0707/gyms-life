import { offlineIdentity } from "../../src/lib/offline-identity";
const USER = "11111111-1111-4111-8111-111111111111";
offlineIdentity.set(USER);
export const useAuth = () => ({
  session: null,
  user: {
    id: USER,
    email: "fixture@example.invalid",
    user_metadata: { full_name: "Alex Fixture" },
  },
  loading: false,
  refresh: async () => true,
});
export const AuthProvider = ({ children }: { children: unknown }) => children;
