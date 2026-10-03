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
/**
 * A route in this fixture, including the loader data a real `Route` exposes.
 *
 * The stub had `useSearch` and `useParams` and no `useLoaderData`, which is not
 * a missing convenience: the moment a route read it, the component threw, the
 * whole tree unmounted, and the synthetic watermark never appeared. That is how
 * `TypeError: Route.useLoaderData is not a function` showed up — after 362
 * checks had passed — rather than as a failed assertion about anything.
 *
 * The real router awaits the loader before it renders the component, so this
 * suspends until the loader resolves. `fixture.tsx` holds the boundary, with
 * the watermark outside it.
 */
export const createFileRoute =
  () =>
  (options: {
    component: ComponentType;
    loader?: (context: { params: Record<string, string> }) => unknown;
    [key: string]: unknown;
  }) => {
    const params = () => ({
      day: new URLSearchParams(location.search).get("day") ?? "1",
      slug: new URLSearchParams(location.search).get("slug") ?? "bench-press",
    });
    let settled: { value: unknown } | undefined;
    let running: Promise<unknown> | undefined;
    return {
      options,
      useSearch: () => ({}),
      useParams: params,
      useLoaderData: () => {
        if (!options.loader) return {} as never;
        running ??= Promise.resolve(options.loader({ params: params() })).then((value) => {
          settled = { value };
        });
        if (!settled) throw running;
        return settled.value as never;
      },
    };
  };
