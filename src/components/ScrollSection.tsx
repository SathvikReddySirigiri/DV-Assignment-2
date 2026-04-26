import type { ReactNode } from "react";
import { useRevealOnce } from "../hooks/useReveal";

type Props = {
  children: (ctx: { revealed: boolean }) => ReactNode;
  minHeightClass?: string;
};

export function ScrollSection({ children, minHeightClass = "min-h-[45vh]" }: Props) {
  const { ref, revealed } = useRevealOnce(0.25);
  return (
    <div ref={ref} className={minHeightClass}>
      {children({ revealed })}
    </div>
  );
}
