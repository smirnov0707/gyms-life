/* eslint-disable react-refresh/only-export-components -- isolated fixture adapter */
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
const screens: Record<string, string> = {
  "/app": "today",
  "/onboarding": "onboarding",
  "/training": "training",
  "/meal-plan": "meals",
  "/nutrition": "nutrition",
};
function href(to: string, params: Record<string, unknown> = {}) {
  const resolved = to.replace(/\$([A-Za-z0-9_]+)/g, (token, key) =>
    params[key] == null ? token : encodeURIComponent(String(params[key])),
  );
  const query = new URLSearchParams(location.search);
  query.set("screen", screens[resolved] ?? "outside");
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
  pathname: new URLSearchParams(location.search).get("route") ?? "/app",
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
  });
