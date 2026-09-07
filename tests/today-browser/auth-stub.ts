export const useAuth = () => ({
  session: null,
  user: { id: "preview", email: "a@b.c", user_metadata: { full_name: "Tomas" } },
  loading: false,
  refresh: async () => true,
});
export const AuthProvider = ({ children }: { children: unknown }) => children;
