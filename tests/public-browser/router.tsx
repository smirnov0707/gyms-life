/* eslint-disable react-refresh/only-export-components -- synthetic browser adapter */
import type { AnchorHTMLAttributes, ReactNode, ComponentType } from "react";
import { params, state } from "./state";
export const useNavigate =
  () =>
  ({ to }: { to: string }) => {
    state.navigations.push(to);
  };
export function createFileRoute(_path: string) {
  return (options: {
    component: ComponentType;
    validateSearch?: (input: Record<string, unknown>) => unknown;
    [key: string]: unknown;
  }) => ({ options, useSearch: () => options.validateSearch?.(Object.fromEntries(params)) ?? {} });
}
export function Link({
  to = "/",
  search,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  search?: Record<string, string>;
  children?: ReactNode;
}) {
  return (
    <a href={to + (search ? "?" + new URLSearchParams(search) : "")} {...rest}>
      {children}
    </a>
  );
}
