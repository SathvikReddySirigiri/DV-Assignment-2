import { useEffect, useRef, useState } from "react";

type Props = {
  end: number;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

export function AnimatedNumber({
  end,
  durationMs = 1200,
  decimals = 0,
  suffix = "",
  prefix = "",
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.25) setActive(true);
      },
      { threshold: [0, 0.25, 0.5, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(end * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setVal(end);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, end, durationMs]);

  const shown = active ? val : 0;
  const text =
    decimals > 0
      ? shown.toFixed(decimals)
      : Math.round(shown).toLocaleString("en-US");

  return (
    <span ref={wrapRef} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
