import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  children?: ReactNode;
};

export function Link({ to, children, ...props }: Props) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
