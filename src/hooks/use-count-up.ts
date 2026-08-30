import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(target: number, duration = 1500, startOnMount = true) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
    if (!startOnMount) return;
    fromRef.current = 0;
    startRef.current = null;

    let raf: number;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(Math.round(fromRef.current + (targetRef.current - fromRef.current) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, startOnMount]);

  return value;
}

export function useCountUpString(
  target: number,
  formatter: (n: number) => string,
  duration = 1500,
  startOnMount = true,
) {
  const value = useCountUp(target, duration, startOnMount);
  return formatter(value);
}
