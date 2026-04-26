type LegendItem = { label: string; color: string };

type Props = {
  items: LegendItem[];
  className?: string;
};

/** Color swatch + label row below charts (editorial static reference style). */
export function ChartLegend({ items, className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--rule-soft)] px-1 pb-1 pt-3 ${className}`}
      role="list"
      aria-label="Chart legend"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 ui-label text-[12px] text-[var(--ink-2)]" role="listitem">
          <span
            className="inline-block h-3.5 w-5 shrink-0 rounded-sm border border-[var(--rule)]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
