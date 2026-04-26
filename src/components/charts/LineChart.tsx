import * as d3 from "d3";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HourlyOntimeRow } from "../../data/aggregations";
import type { CarrierName } from "../../data/types";
import {
  AXIS_LABEL_PX,
  AXIS_STROKE,
  AXIS_STROKE_WIDTH,
  AXIS_TICK_FILL,
  AXIS_TICK_STROKE_WIDTH,
  CHART_HEIGHT_DEFAULT,
  CHART_MIN_WIDTH,
  LINE_STROKE,
  TICK_FONT_PX,
} from "./chartLayout";
import { ChartLegend } from "./ChartLegend";

const COLORS: Record<CarrierName, string> = {
  American: "var(--carrier-american)",
  Delta: "var(--carrier-delta)",
  Southwest: "var(--carrier-southwest)",
};

const LABELS: Record<CarrierName, string> = {
  American: "American",
  Delta: "Delta",
  Southwest: "Southwest",
};

type Props = {
  rows: HourlyOntimeRow[];
  revealed: boolean;
  compact?: boolean;
  showXAxisLabel?: boolean;
};

const margin = { top: 32, right: 20, bottom: 48, left: 52 };
const compactMargin = { top: 30, right: 20, bottom: 50, left: 50 };

export function LineChart({ rows, revealed, compact = false, showXAxisLabel = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Partial<Record<CarrierName, SVGPathElement | null>>>({});
  const chartHeight = compact ? 300 : CHART_HEIGHT_DEFAULT;
  const [size, setSize] = useState({ w: compact ? 360 : 560, h: compact ? 280 : chartHeight });
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [lengths, setLengths] = useState<Record<CarrierName, number>>({
    American: 1000,
    Delta: 1000,
    Southwest: 1000,
  });
  const [dashOff, setDashOff] = useState<Record<CarrierName, number>>({
    American: 1000,
    Delta: 1000,
    Southwest: 1000,
  });

  useEffect(() => {
    if (compact) {
      setSize({ w: 360, h: 280 });
      return;
    }
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(CHART_MIN_WIDTH, r.width), h: chartHeight });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(CHART_MIN_WIDTH, r.width), h: chartHeight });
    return () => ro.disconnect();
  }, [chartHeight, compact]);

  const m = compact ? compactMargin : margin;

  const byCarrier = useMemo(() => {
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    const map = new Map<CarrierName, { hour: number; pct: number }[]>();
    for (const c of carriers) {
      const pts = rows
        .filter((r) => r.carrier === c)
        .map((r) => ({ hour: r.hour, pct: r.pct_ontime }))
        .sort((a, b) => a.hour - b.hour);
      map.set(c, pts);
    }
    return map;
  }, [rows]);

  const layout = useMemo(() => {
    const w = size.w - m.left - m.right;
    const h = size.h - m.top - m.bottom;
    const xScale = d3.scaleLinear().domain([5, 21]).range([0, w]);
    const allPct = rows.map((r) => r.pct_ontime);
    const yMin = Math.min(40, d3.min(allPct) ?? 40) - 3;
    const yScale = d3.scaleLinear().domain([yMin, 100]).range([h, 0]).nice();
    const gen = d3
      .line<{ hour: number; pct: number }>()
      .x((d) => xScale(d.hour))
      .y((d) => yScale(d.pct))
      .curve(d3.curveMonotoneX);
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    const pathStrs: Record<CarrierName, string> = {
      American: "",
      Delta: "",
      Southwest: "",
    };
    for (const c of carriers) {
      const pts = byCarrier.get(c) ?? [];
      pathStrs[c] = pts.length ? gen(pts) ?? "" : "";
    }
    return { x: xScale, y: yScale, paths: pathStrs, w, h };
  }, [rows, size, byCarrier, m.left, m.right, m.top, m.bottom]);

  const { x, y, paths, w, h } = layout;

  useLayoutEffect(() => {
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    const L: Record<CarrierName, number> = { American: 1000, Delta: 1000, Southwest: 1000 };
    for (const c of carriers) {
      const p = pathRefs.current[c];
      L[c] = p?.getTotalLength() ?? 1000;
    }
    setLengths(L);
    if (!revealed) setDashOff(L);
  }, [revealed, paths, w, h]);

  useEffect(() => {
    if (!revealed) return;
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    let cancelled = false;
    const run = () => {
      const L: Record<CarrierName, number> = { American: 1000, Delta: 1000, Southwest: 1000 };
      for (const c of carriers) {
        const p = pathRefs.current[c];
        L[c] = p?.getTotalLength() ?? 1000;
      }
      if (cancelled) return;
      setLengths(L);
      setDashOff(L);
      const duration = 1600;
      const stagger = 200;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const next: Record<CarrierName, number> = { American: 0, Delta: 0, Southwest: 0 };
        let done = true;
        carriers.forEach((c, i) => {
          const t = Math.min(1, (now - t0 - i * stagger) / duration);
          const eased = d3.easeCubicOut(t);
          next[c] = L[c] * (1 - eased);
          if (t < 1) done = false;
        });
        setDashOff(next);
        if (!done) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(run);
    return () => {
      cancelled = true;
    };
  }, [revealed]);

  const xticks = [6, 9, 12, 15, 18, 21];
  const yticks = y.ticks(5);

  const pointerMove = (evt: React.PointerEvent<SVGRectElement>) => {
    const svg = evt.currentTarget.ownerSVGElement;
    if (!svg) return;
    const layer = evt.currentTarget.parentNode;
    if (!(layer instanceof SVGGElement)) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = layer.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const raw = x.invert(p.x);
    const hour = Math.round(raw);
    if (!Number.isFinite(hour)) {
      setHoverHour(null);
      return;
    }
    setHoverHour(Math.max(5, Math.min(21, hour)));
  };

  const tooltipData = useMemo(() => {
    if (hoverHour == null || !Number.isFinite(hoverHour)) return null;
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    return carriers.map((c) => {
      const pt = (byCarrier.get(c) ?? []).find((p) => p.hour === hoverHour);
      return { c, pct: pt?.pct };
    });
  }, [hoverHour, byCarrier]);

  const showHover = hoverHour != null && Number.isFinite(hoverHour) && tooltipData;

  return (
    <div ref={hostRef} className="chart-frame relative w-full overflow-hidden" onPointerLeave={() => setHoverHour(null)}>
      <svg
        width={compact ? "100%" : size.w}
        height={compact ? undefined : size.h}
        viewBox={compact ? "0 0 360 280" : undefined}
        preserveAspectRatio={compact ? "xMidYMid meet" : undefined}
        className="block w-full"
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {yticks.map((t) => (
            <g key={String(t)}>
              <line
                x1={0}
                x2={w}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--rule-soft)"
                strokeWidth={1}
              />
              <text
                x={-10}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                className="tick-label"
                fill={AXIS_TICK_FILL}
                style={{ fontSize: TICK_FONT_PX }}
              >
                {`${t}%`}
              </text>
            </g>
          ))}
          {xticks.map((t) => (
            <g key={String(t)} transform={`translate(${x(t)},${h})`}>
              <line y2={6} stroke={AXIS_STROKE} strokeWidth={AXIS_TICK_STROKE_WIDTH} />
              <text y={22} textAnchor="middle" className="tick-label" fill={AXIS_TICK_FILL} style={{ fontSize: TICK_FONT_PX }}>
                {t}
              </text>
            </g>
          ))}
          <line x1={0} x2={w} y1={h} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <line x1={0} x2={0} y1={0} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          {showXAxisLabel && (
            <text
              x={w / 2}
              y={h + 34}
              textAnchor="middle"
              className="ui-label fill-[var(--ink-soft)]"
              style={{ fontSize: AXIS_LABEL_PX }}
            >
              Scheduled hour (local)
            </text>
          )}
          <text
            transform="rotate(-90)"
            x={-h / 2}
            y={-36}
            textAnchor="middle"
            className="ui-label fill-[var(--ink-soft)]"
            style={{ fontSize: AXIS_LABEL_PX }}
          >
            On-time %
          </text>
          {(["American", "Delta", "Southwest"] as const).map((c) => {
            const len = lengths[c] || 1000;
            return (
              <path
                key={c}
                ref={(el) => {
                  pathRefs.current[c] = el;
                }}
                d={paths[c]}
                fill="none"
                stroke={COLORS[c]}
                strokeWidth={LINE_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${len} ${len}`}
                strokeDashoffset={dashOff[c]}
              />
            );
          })}
          {showHover && hoverHour != null && (
            <line
              x1={x(hoverHour)}
              x2={x(hoverHour)}
              y1={0}
              y2={h}
              stroke="var(--ink-soft)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          )}
          <rect width={w} height={h} fill="transparent" onPointerMove={pointerMove} />
        </g>
      </svg>
      {showHover && tooltipData && hoverHour != null && (
        <div
          className="chart-tooltip pointer-events-none absolute z-20 max-w-[220px]"
          style={{
            left: Math.max(8, Math.min(size.w - 200, m.left + x(hoverHour) + 8)),
            top: m.top + 8,
          }}
        >
          <div className="ui-label font-semibold">Hour {hoverHour}</div>
          {tooltipData.map(({ c, pct }) => (
            <div key={c} className="flex justify-between gap-3">
              <span style={{ color: COLORS[c] }}>{LABELS[c]}</span>
              <span>{pct != null ? `${pct.toFixed(1)}%` : "—"}</span>
            </div>
          ))}
        </div>
      )}
      {revealed && (
        <>
          <div
            className="pointer-events-none absolute text-[10px] ui-label"
            style={{ left: m.left + x(6) + 4, top: m.top + y(83) - 36 }}
          >
            <div className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink)] shadow-sm opacity-0 animate-[noteIn_0.55s_ease_forwards_2.05s]">
              6 AM: ~83%
            </div>
          </div>
          <div
            className="pointer-events-none absolute text-[10px] ui-label"
            style={{ left: m.left + x(20) - 40, top: m.top + y(48) - 8 }}
          >
            <div className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--ink)] shadow-sm opacity-0 animate-[noteIn_0.55s_ease_forwards_2.25s]">
              8 PM: ~48%
            </div>
          </div>
          <div
            className="pointer-events-none absolute text-[11px] ui-label text-[var(--bad)] italic"
            style={{ left: m.left + x(14), top: m.top + 12 }}
          >
            <div className="opacity-0 animate-[noteIn_0.55s_ease_forwards_2.45s]">−34 percentage points</div>
          </div>
        </>
      )}
      <ChartLegend
        items={[
          { label: "American", color: "var(--carrier-american)" },
          { label: "Delta", color: "var(--carrier-delta)" },
          { label: "Southwest", color: "var(--carrier-southwest)" },
        ]}
      />
      <style>{`
        @keyframes noteIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
