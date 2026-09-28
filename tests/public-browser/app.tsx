/* The public-route fixture stubs only the authenticated application boundary. */
import type { ReactNode } from "react";
export function AppShell({ children }: { children: ReactNode }) {
  return <div data-testid="signed-in-shell">{children}</div>;
}
export function Overview() {
  return <h1>Signed-in Today</h1>;
}
