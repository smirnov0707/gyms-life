export const useAuth = () => ({
  session: null,
  user: {
    id: "preview",
    email: "fixture@example.invalid",
    user_metadata: { full_name: "Alex Fixture" },
  },
  loading: false,
  refresh: async () => true,
});
export const AuthProvider = ({ children }: { children: unknown }) => children;
