/* eslint-disable react-refresh/only-export-components -- fixture-only router adapter */
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";

const screens: Record<string, string> = {
  "/app": "today",
  "/twin": "twin",
  "/lab": "lab",
  "/progress": "futureme",
  "/history": "journal",
};
const paths = Object.fromEntries(Object.entries(screens).map(([path, screen]) => [screen, path]));
export function fixtureHref(to: string, params: Record<string, unknown> = {}) {
  const resolved = to.replace(/\$([A-Za-z0-9_]+)/g, (token, key) =>
    params[key] == null ? token : encodeURIComponent(String(params[key])),
  );
  const query = new URLSearchParams(window.location.search);
  if (query.get("shell") !== "1") return "#";
  query.set("screen", screens[resolved] ?? "outside-fixture");
  query.set("route", resolved);
  return `/index.html?${query}`;
}
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  params?: Record<string, unknown>;
  children?: ReactNode;
};
export function Link({ to = "/app", params, children, ...rest }: LinkProps) {
  return (
    <a href={fixtureHref(to, params)} {...rest}>
      {children}
    </a>
  );
}
export const useLocation = () => {
  const query = new URLSearchParams(window.location.search);
  const screen = query.get("screen") ?? "today";
  return {
    pathname: query.get("route") ?? (screen === "muscle" ? "/twin" : (paths[screen] ?? "/app")),
    search: {},
  };
};
const navigate = (options: { to?: string; params?: Record<string, unknown> } | string) => {
  const target = typeof options === "string" ? options : (options.to ?? "/app");
  window.location.assign(
    fixtureHref(target, typeof options === "string" ? undefined : options.params),
  );
};
export const useNavigate = () => navigate;
export const useRouter = () => ({ navigate, invalidate: async () => {} });
export const createFileRoute =
  () => (options: { component: ComponentType; [key: string]: unknown }) => ({ options });
