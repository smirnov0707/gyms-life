/* eslint-disable react-refresh/only-export-components -- fixture-only router adapter */
import {
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";

const screens: Record<string, string> = {
  "/app": "today",
  "/twin": "twin",
  "/lab": "lab",
  "/coach": "coach",
  "/twin?view=future": "futureme",
  "/twin?view=journal": "journal",
};
const paths = Object.fromEntries(Object.entries(screens).map(([path, screen]) => [screen, path]));
export function fixtureHref(
  to: string,
  params: Record<string, unknown> = {},
  search?: Record<string, unknown>,
) {
  const resolved = to.replace(/\$([A-Za-z0-9_]+)/g, (token, key) =>
    params[key] == null ? token : encodeURIComponent(String(params[key])),
  );
  const query = new URLSearchParams(window.location.search);
  if (query.get("shell") !== "1") return "#";
  query.set("screen", screens[resolved] ?? "outside-fixture");
  query.set("route", resolved);
  for (const key of ["view", "region", "detail"]) query.delete(key);
  for (const [key, value] of Object.entries(search ?? {}))
    if (value !== undefined) query.set(key, String(value));
  return `/index.html?${query}`;
}
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  children?: ReactNode;
};
export function Link({ to = "/app", params, search, children, ...rest }: LinkProps) {
  return (
    <a href={fixtureHref(to, params, search)} {...rest}>
      {children}
    </a>
  );
}
const fixtureLocation = () => {
  const query = new URLSearchParams(window.location.search);
  const screen = query.get("screen") ?? "today";
  return {
    pathname:
      query.get("route") ??
      (["muscle", "futureme", "journal"].includes(screen) ? "/twin" : (paths[screen] ?? "/app")),
    search: {},
  };
};
export const useLocation = fixtureLocation;
const navigate = (
  options:
    { to?: string; params?: Record<string, unknown>; search?: Record<string, unknown> } | string,
) => {
  const target = typeof options === "string" ? options : (options.to ?? fixtureLocation().pathname);
  const href = fixtureHref(
    target,
    typeof options === "string" ? undefined : options.params,
    typeof options === "string" ? undefined : options.search,
  );
  // Search-only navigation inside My Twin changes the selected view/region,
  // not the fixture route. Preserve special Twin reference screens such as
  // "muscle" so the harness exercises the same in-place detail transition as
  // the real router instead of silently remounting the generic Twin screen.
  // Notify search subscribers without a document reload, preserving tab focus.
  if (typeof options !== "string" && !options.to && target === "/twin") {
    const next = new URL(href, window.location.origin);
    const currentScreen = new URLSearchParams(window.location.search).get("screen");
    if (currentScreen && ["twin", "muscle", "futureme", "journal"].includes(currentScreen)) {
      next.searchParams.set("screen", currentScreen);
    }
    window.history.pushState(null, "", `${next.pathname}?${next.searchParams}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.location.assign(href);
};
export const useNavigate = () => navigate;

export function redirect(options: { to: string; search?: Record<string, unknown> }) {
  return Object.assign(new Error(`Fixture redirect to ${options.to}`), {
    options,
    isRedirect: true,
  });
}
export const useRouter = () => ({ navigate, invalidate: async () => {} });
const subscribeToSearch = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const searchSnapshot = () => window.location.search;

export const createFileRoute =
  () =>
  (options: {
    component: ComponentType;
    validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
    [key: string]: unknown;
  }) => ({
    options,
    useSearch: () => {
      const search = useSyncExternalStore(subscribeToSearch, searchSnapshot);
      return options.validateSearch?.(Object.fromEntries(new URLSearchParams(search))) ?? {};
    },
    useNavigate: () => navigate,
  });
