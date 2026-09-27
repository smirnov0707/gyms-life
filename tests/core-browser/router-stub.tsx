/* eslint-disable react-refresh/only-export-components -- isolated fixture adapter */
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
const screens: Record<string, string> = {
  "/app": "today",
  "/ar": "camera",
  "/exercises": "exercises",
  "/onboarding": "onboarding",
  "/training": "training",
  "/meal-plan": "meals",
  "/nutrition": "nutrition",
  "/supplements": "supplements",
  "/me": "profile",
  "/readiness": "readiness",
  "/workout/1": "workout",
};
function href(to: string, params: Record<string, unknown> = {}) {
  const resolved = to.replace(/\$([A-Za-z0-9_]+)/g, (token, key) =>
    params[key] == null ? token : encodeURIComponent(String(params[key])),
  );
  const query = new URLSearchParams(location.search);
  query.set(
    "screen",
    resolved.startsWith("/exercises/") ? "movement" : (screens[resolved] ?? "outside"),
  );
  if (params.slug != null) query.set("slug", String(params.slug));
  query.set("route", resolved);
  return `/index.html?${query}`;
}
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  children?: ReactNode;
};
export function Link({ to = "/app", params, search: _search, children, ...rest }: LinkProps) {
  return (
    <a href={href(to, params)} {...rest}>
      {children}
    </a>
  );
}
export const useLocation = () => ({
  pathname:
    new URLSearchParams(location.search).get("route") ??
    (new URLSearchParams(location.search).get("screen") === "movement"
      ? `/exercises/${new URLSearchParams(location.search).get("slug") ?? "bench-press"}`
      : undefined) ??
    Object.entries(screens).find(
      ([, screen]) => screen === new URLSearchParams(location.search).get("screen"),
    )?.[0] ??
    "/app",
  search: {},
});
export const useNavigate =
  () =>
  ({ to }: { to: string }) =>
    location.assign(href(to));
export const useRouter = () => ({
  navigate: ({ to }: { to: string }) => location.assign(href(to)),
  invalidate: async () => {},
});
export const createFileRoute =
  () => (options: { component: ComponentType; [key: string]: unknown }) => ({
    options,
    useSearch: () => ({}),
    useParams: () => ({
      day: new URLSearchParams(location.search).get("day") ?? "1",
      slug: new URLSearchParams(location.search).get("slug") ?? "bench-press",
    }),
  });
