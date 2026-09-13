import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({
  children,
  className,
  glowColor = "var(--primary-glow)",
}: {
  children?: ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--glow-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    element.style.setProperty("--glow-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    element.style.setProperty("--glow-opacity", "1");
  };

  const handleLeave = () => {
    ref.current?.style.setProperty("--glow-opacity", "0");
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("fl-glow-card relative overflow-hidden", className)}
      style={{ "--glow-color": glowColor } as CSSProperties}
    >
      <div
        aria-hidden="true"
        className="fl-glow-card-light pointer-events-none absolute -inset-px"
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
