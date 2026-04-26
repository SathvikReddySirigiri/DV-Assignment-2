import * as d3 from "d3";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HourlyCauseShareRow } from "../../data/aggregations";
import {
  AXIS_LABEL_PX,
  AXIS_STROKE,
  AXIS_STROKE_WIDTH,
  AXIS_TICK_FILL,
  AXIS_TICK_STROKE_WIDTH,
  CHART_HEIGHT_DEFAULT,
  CHART_MIN_WIDTH,
  TICK_FONT_PX,
} from "./chartLayout";
import { ChartLegend } from "./ChartLegend";

type Props = {
  rows: HourlyCauseShareRow[];
  revealed: boolean;
  compact?: boolean;
  showXAxisLabel?: boolean;
};

const margin = { top: 28, right: 16, bottom: 44, left: 48 };
const compactMargin = { top: 30, right: 20, bottom: 50, left: 50 };
const keys = ["weather", "nas", "carrier", "late_aircraft"] as const;
type Key = (typeof keys)[number];

const FILL: Record<Key, string> = {
  weather: "#b48a2a",
  nas: "#334152",
  carrier: "#c9bfa9",
  late_aircraft: "#c4451c",
};

const LEGEND_LABELS: Record<Key, string> = {
  weather: "Weather",
  nas: "Air traffic",
  carrier: "Airline ops",
  late_aircraft: "Previous-flight delay",
};

export function StackedCauseChart({ rows, revealed, compact = false, showXAxisLabel = true }: Props) {
  const clipId = useId().replace(/:/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const chartHeight = compact ? 300 : CHART_HEIGHT_DEFAULT;
  const [size, setSize] = useState({ w: compact ? 360 : 560, h: compact ? 280 : chartHeight });
  const [prog, setProg] = useState(0);
  const [hoverHour, setHoverHour] = useState<number | null>(null);

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

  useEffect(() => {
    if (!revealed) {
      setProg(0);
      return;
    }
    const dur = 1400;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setProg(d3.easeCubicOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  const { x, y, areas, w, h } = useMemo(() => {
    const w0 = size.w - m.left - m.right;
    const h0 = size.h - m.top - m.bottom;
    const sorted = [...rows].sort((a, b) => a.hour - b.hour);
    const xScale = d3.scaleLinear().domain([5, 21]).range([0, w0]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([h0, 0]);
    const stack = d3
      .stack<HourlyCauseShareRow>()
      .keys([...keys])
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);
    const series = stack(sorted);
    const areaGen = d3
      .area<d3.SeriesPoint<HourlyCauseShareRow>>()
      .x((d) => xScale(d.data.hour))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);
    const ar = series.map((s) => ({
      key: s.key as Key,
      d: areaGen(s) ?? "",
    }));
    return { x: xScale, y: yScale, areas: ar, w: w0, h: h0 };
  }, [rows, size, m.left, m.right, m.top, m.bottom]);

  const clipY = h * (1 - prog);
  const clipH = h * prog;

  const pointerMove = (evt: React.PointerEvent<SVGRectElement>) => {
    const svg = (evt.target as Element).ownerSVGElement;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const layer = evt.currentTarget.parentElement as SVGGElement;
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

  const tip = useMemo(() => {
    if (hoverHour == null || !Number.isFinite(hoverHour)) return null;
    return rows.find((r) => r.hour === hoverHour) ?? null;
  }, [hoverHour, rows]);

  const xticks = [6, 9, 12, 15, 18, 21];
  const showHover = hoverHour != null && Number.isFinite(hoverHour) && tip;

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
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={clipY} width={w} height={clipH} />
            </clipPath>
          </defs>
          {d3.range(0, 101, 25).map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="var(--rule-soft)" strokeWidth={1} />
              <text
                x={-8}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                className="tick-label"
                fill={AXIS_TICK_FILL}
                style={{ fontSize: TICK_FONT_PX }}
              >
                {t}%
              </text>
            </g>
          ))}
          {xticks.map((t) => (
            <g key={String(t)} transform={`translate(${x(t)},${y(0)})`}>
              <line y2={6} stroke={AXIS_STROKE} strokeWidth={AXIS_TICK_STROKE_WIDTH} />
              <text y={24} textAnchor="middle" className="tick-label" fill={AXIS_TICK_FILL} style={{ fontSize: TICK_FONT_PX }}>
                {t}
              </text>
            </g>
          ))}
          <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <line x1={0} x2={0} y1={y(100)} y2={y(0)} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          {showXAxisLabel && (
            <text
              x={w / 2}
              y={h + 38}
              textAnchor="middle"
              className="ui-label"
              fill="var(--ink-soft)"
              style={{ fontSize: AXIS_LABEL_PX }}
            >
              Scheduled hour (local)
            </text>
          )}
          <text
            transform="rotate(-90)"
            x={-h / 2}
            y={-38}
            textAnchor="middle"
            className="ui-label"
            fill="var(--ink-soft)"
            style={{ fontSize: AXIS_LABEL_PX }}
          >
            Attributed delay share (%)
          </text>
          <g clipPath={`url(#${clipId})`}>
            {areas.map((a) => (
              <path key={a.key} d={a.d} fill={FILL[a.key]} stroke="none" />
            ))}
          </g>
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
      {showHover && tip && hoverHour != null && (
        <div
          className="chart-tooltip pointer-events-none absolute z-20 max-w-[220px]"
          style={{ left: Math.max(8, Math.min(size.w - 200, m.left + x(hoverHour) + 8)), top: m.top + 8 }}
        >
          <div className="ui-label font-semibold">Hour {hoverHour}</div>
          <div>Weather {tip.weather.toFixed(1)}%</div>
          <div>Air traffic {tip.nas.toFixed(1)}%</div>
          <div>Airline ops {tip.carrier.toFixed(1)}%</div>
          <div style={{ color: FILL.late_aircraft }}>Previous-flight delay {tip.late_aircraft.toFixed(1)}%</div>
        </div>
      )}
      {revealed && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-3 text-[13px] ui-label">
          <span className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--bad)] opacity-0 animate-[pulseLabel_0.85s_ease_1.45s_forwards]">
            14% inherited (6 AM)
          </span>
          <span className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[var(--bad)] opacity-0 animate-[pulseLabel_0.85s_ease_1.65s_forwards]">
            69% inherited (8 PM)
          </span>
        </div>
      )}
      <ChartLegend
        className={compact ? "!grid !grid-cols-2 !gap-x-4 !gap-y-2" : ""}
        items={keys.map((k) => ({
          label: LEGEND_LABELS[k],
          color: FILL[k],
        }))}
      />
      <style>{`
        @keyframes pulseLabel {
          0% { opacity: 0; transform: scale(1); }
          25% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
