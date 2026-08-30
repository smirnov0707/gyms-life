import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MagneticButton({
  children,
  className,
  strength = 0.25,
  ...props
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0 });

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTransform({ x: x * strength, y: y * strength });
  };

  const handleLeave = () => setTransform({ x: 0, y: 0 });

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("transition-transform duration-150 ease-out will-change-transform", className)}
      style={{
        transform: `translate(${transform.x}px, ${transform.y}px)`,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
