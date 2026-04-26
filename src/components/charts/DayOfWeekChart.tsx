import * as d3 from "d3";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DayOfWeekDelayRow } from "../../data/aggregations";
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

type Props = {
  rows: DayOfWeekDelayRow[];
  revealed: boolean;
};

const DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const COLORS: Record<CarrierName, string> = {
  American: "var(--carrier-american)",
  Delta: "var(--good)",
  Southwest: "var(--bad)",
};

const LABELS: Record<CarrierName, string> = {
  American: "American",
  Delta: "Delta",
  Southwest: "Southwest",
};

const margin = { top: 36, right: 70, bottom: 50, left: 50 };

export function DayOfWeekChart({ rows, revealed }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Partial<Record<CarrierName, SVGPathElement | null>>>({});
  const [size, setSize] = useState({ w: 560, h: CHART_HEIGHT_DEFAULT });
  const [hoverDow, setHoverDow] = useState<number | null>(null);
  const [lengths, setLengths] = useState<Record<CarrierName, number>>({
    American: 900,
    Delta: 900,
    Southwest: 900,
  });
  const [dashOff, setDashOff] = useState<Record<CarrierName, number>>({
    American: 900,
    Delta: 900,
    Southwest: 900,
  });
  const [dotsOp, setDotsOp] = useState(0);
  const [annOp, setAnnOp] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(CHART_MIN_WIDTH, r.width), h: CHART_HEIGHT_DEFAULT });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(CHART_MIN_WIDTH, r.width), h: CHART_HEIGHT_DEFAULT });
    return () => ro.disconnect();
  }, []);

  const byCarrier = useMemo(() => {
    const carriers: CarrierName[] = ["American", "Delta", "Southwest"];
    const map = new Map<CarrierName, { dow: number; mean_delay: number }[]>();
    for (const c of carriers) {
      map.set(
        c,
        rows
          .filter((r) => r.carrier === c)
          .map((r) => ({ dow: r.dow, mean_delay: r.mean_delay }))
          .sort((a, b) => a.dow - b.dow)
      );
    }
    return map;
  }, [rows]);

  const layout = useMemo(() => {
    const w = size.w - margin.left - margin.right;
    const h = size.h - margin.top - margin.bottom;
    const x = d3.scalePoint<number>().domain([0, 1, 2, 3, 4, 5, 6]).range([0, w]).padding(0.2);
    const y = d3.scaleLinear().domain([5, 16]).range([h, 0]).nice();
    const line = d3
      .line<{ dow: number; mean_delay: number }>()
      .x((d) => x(d.dow) ?? 0)
      .y((d) => y(d.mean_delay))
      .curve(d3.curveMonotoneX);
    const paths: Record<CarrierName, string> = { American: "", Delta: "", Southwest: "" };
    (["American", "Delta", "Southwest"] as const).forEach((c) => {
      const pts = byCarrier.get(c) ?? [];
      paths[c] = pts.length ? line(pts) ?? "" : "";
    });
    return { x, y, w, h, paths };
  }, [size, byCarrier]);

  const { x, y, w, h, paths } = layout;

  useLayoutEffect(() => {
    const L: Record<CarrierName, number> = { American: 900, Delta: 900, Southwest: 900 };
    (["American", "Delta", "Southwest"] as const).forEach((c) => {
      L[c] = pathRefs.current[c]?.getTotalLength() ?? 900;
    });
    setLengths(L);
    if (!revealed) {
      setDashOff(L);
      setDotsOp(0);
      setAnnOp(0);
    }
  }, [paths, revealed, w, h]);

  useEffect(() => {
    if (!revealed) return;
    let cancelled = false;
    const L: Record<CarrierName, number> = { American: 900, Delta: 900, Southwest: 900 };
    (["American", "Delta", "Southwest"] as const).forEach((c) => {
      L[c] = pathRefs.current[c]?.getTotalLength() ?? 900;
    });
    setLengths(L);
    setDashOff(L);
    setDotsOp(0);
    setAnnOp(0);

    const duration = 1400;
    const stagger = 200;
    const linesTotal = duration + stagger * 2;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const el = now - t0;
      const next: Record<CarrierName, number> = { American: 0, Delta: 0, Southwest: 0 };
      (["American", "Delta", "Southwest"] as const).forEach((c, i) => {
        const t = Math.min(1, Math.max(0, (el - i * stagger) / duration));
        next[c] = L[c] * (1 - d3.easeCubicOut(t));
      });
      setDashOff(next);
      if (el > linesTotal) {
        setDotsOp(Math.min(1, (el - linesTotal) / 300));
        setAnnOp(Math.min(1, (el - linesTotal - 200) / 500));
      }
      if (el < linesTotal + 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [revealed]);

  const pointerMove = (evt: React.PointerEvent<SVGRectElement>) => {
    const svg = evt.currentTarget.ownerSVGElement;
    if (!svg) return;
    const layer = evt.currentTarget.parentNode;
    if (!(layer instanceof SVGGElement)) return;
    const ctm = layer.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    let best: number | null = null;
    let bestDx = Number.POSITIVE_INFINITY;
    for (const d of [0, 1, 2, 3, 4, 5, 6]) {
      const dx = Math.abs((x(d) ?? 0) - p.x);
      if (dx < bestDx) {
        bestDx = dx;
        best = d;
      }
    }
    setHoverDow(best);
  };

  const tooltipData = useMemo(() => {
    if (hoverDow == null) return null;
    return (["American", "Delta", "Southwest"] as const).map((c) => {
      const v = rows.find((r) => r.carrier === c && r.dow === hoverDow)?.mean_delay;
      return { c, v };
    });
  }, [hoverDow, rows]);

  const tuesdayLowestCarrier = useMemo(() => {
    const tue = rows.filter((r) => r.dow === 1);
    if (!tue.length) return null;
    return [...tue].sort((a, b) => a.mean_delay - b.mean_delay)[0]!;
  }, [rows]);
  const sundayHighestCarrier = useMemo(() => {
    const sun = rows.filter((r) => r.dow === 6);
    if (!sun.length) return null;
    return [...sun].sort((a, b) => b.mean_delay - a.mean_delay)[0]!;
  }, [rows]);

  const showHover = hoverDow != null && tooltipData;

  return (
    <div ref={hostRef} className="chart-frame relative w-full overflow-hidden" onPointerLeave={() => setHoverDow(null)}>
      <svg width={size.w} height={size.h} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(4).map((t) => (
            <g key={String(t)}>
              <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="var(--rule-soft)" strokeWidth={1} />
              <text x={-10} y={y(t)} dy="0.35em" textAnchor="end" className="tick-label" fill={AXIS_TICK_FILL} style={{ fontSize: TICK_FONT_PX }}>
                {t}
              </text>
            </g>
          ))}
          {DOW_NAMES.map((name, dow) => (
            <g key={name} transform={`translate(${x(dow) ?? 0},${h})`}>
              <line y2={6} stroke={AXIS_STROKE} strokeWidth={AXIS_TICK_STROKE_WIDTH} />
              <text y={22} textAnchor="middle" className="tick-label" fill={AXIS_TICK_FILL} style={{ fontSize: TICK_FONT_PX }}>
                {name}
              </text>
            </g>
          ))}
          <line x1={0} x2={w} y1={h} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <line x1={0} x2={0} y1={0} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <text transform="rotate(-90)" x={-h / 2} y={-36} textAnchor="middle" className="ui-label fill-[var(--ink-soft)]" style={{ fontSize: AXIS_LABEL_PX }}>
            Mean delay (min)
          </text>
          {(Object.keys(paths) as CarrierName[]).map((c) => {
            const len = lengths[c] || 900;
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
          {dotsOp > 0 &&
            (["American", "Delta", "Southwest"] as const).map((c) =>
              (byCarrier.get(c) ?? []).map((pt) => (
                <circle key={`${c}-${pt.dow}`} cx={x(pt.dow) ?? 0} cy={y(pt.mean_delay)} r={3.4} fill={COLORS[c]} opacity={dotsOp} />
              ))
            )}
          {showHover && hoverDow != null && <line x1={x(hoverDow) ?? 0} x2={x(hoverDow) ?? 0} y1={0} y2={h} stroke="var(--ink-soft)" strokeDasharray="4 3" strokeWidth={1} />}
          <rect width={w} height={h} fill="transparent" onPointerMove={pointerMove} />
          {tuesdayLowestCarrier && (
            <g opacity={annOp}>
              <text
                x={x(1) ?? 0}
                y={y(tuesdayLowestCarrier.mean_delay) + 22}
                textAnchor="middle"
                fill="var(--good)"
                style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 13, fontWeight: 500 }}
              >
                Tuesday: the trough
              </text>
              <text
                x={x(1) ?? 0}
                y={y(tuesdayLowestCarrier.mean_delay) + 10}
                textAnchor="middle"
                fill="var(--good)"
                style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 8, fontWeight: 500 }}
              >
                ▼
              </text>
            </g>
          )}
          {sundayHighestCarrier && (
            <g opacity={annOp}>
              <text
                x={x(6) ?? 0}
                y={y(sundayHighestCarrier.mean_delay) - 18}
                textAnchor="middle"
                fill="var(--bad)"
                style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 13, fontWeight: 500 }}
              >
                Sunday: the climb
              </text>
              <text
                x={x(6) ?? 0}
                y={y(sundayHighestCarrier.mean_delay) - 4}
                textAnchor="middle"
                fill="var(--bad)"
                style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 8, fontWeight: 500 }}
              >
                ▲
              </text>
            </g>
          )}
        </g>
      </svg>
      {showHover && tooltipData && hoverDow != null && (
        <div
          className="chart-tooltip pointer-events-none absolute z-20 max-w-[230px] px-3 py-2"
          style={{
            left: Math.max(8, Math.min(size.w - 230, margin.left + (x(hoverDow) ?? 0) + 8)),
            top: margin.top + 8,
            fontFamily: "Fraunces, Georgia, serif",
            fontStyle: "italic",
          }}
        >
          <div className="mb-1 ui-label not-italic" style={{ fontFamily: "Inter Tight, sans-serif" }}>
            {DOW_NAMES[hoverDow]}
          </div>
          {tooltipData.map(({ c, v }) => (
            <div key={c} className="flex justify-between gap-4 text-[13px]">
              <span style={{ color: COLORS[c] }}>{LABELS[c]}</span>
              <span>{v != null ? `${v.toFixed(1)} min` : "—"}</span>
            </div>
          ))}
        </div>
      )}
      <ChartLegend
        items={[
          { label: "American", color: "var(--carrier-american)" },
          { label: "Delta", color: "var(--good)" },
          { label: "Southwest", color: "var(--bad)" },
        ]}
      />
    </div>
  );
}
