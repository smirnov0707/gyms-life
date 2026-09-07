/* eslint-disable react-refresh/only-export-components -- a stand-in for one
   package has to export that package's hooks alongside its component, and
   nothing here is ever hot-reloaded: it is only loaded by the browser test. */
import type { AnchorHTMLAttributes, ReactNode } from "react";

/** Router stand-in: links render, navigation does nothing. Test-only. */
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; children?: ReactNode };

export function Link({ to: _to, children, ...rest }: LinkProps) {
  return (
    <a href="#" {...rest}>
      {children}
    </a>
  );
}

export const useNavigate = () => () => {};
export const useRouter = () => ({ navigate: () => {} });
export const createFileRoute = () => () => ({});
