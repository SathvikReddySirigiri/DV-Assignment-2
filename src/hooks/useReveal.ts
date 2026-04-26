import { useEffect, useRef, useState, type RefObject } from "react";

/** Fires once when ≥ `threshold` of the element intersects the viewport. */
export function useRevealOnce(threshold = 0.25): { ref: RefObject<HTMLDivElement>; revealed: boolean } {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= threshold) {
            setRevealed(true);
            break;
          }
        }
      },
      { threshold: [0, 0.1, 0.2, 0.25, 0.35, 0.5, 0.75, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [revealed, threshold]);

  return { ref, revealed };
}
