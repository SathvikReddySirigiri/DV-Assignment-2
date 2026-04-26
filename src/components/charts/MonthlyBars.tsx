import * as d3 from "d3";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MonthlyDelayRow } from "../../data/aggregations";
import {
  AXIS_STROKE,
  AXIS_STROKE_WIDTH,
  AXIS_TICK_FILL,
  CHART_HEIGHT_DEFAULT,
  CHART_MIN_WIDTH,
  TICK_FONT_PX,
} from "./chartLayout";
import { ChartLegend } from "./ChartLegend";

type Props = {
  rows: MonthlyDelayRow[];
  overallMeanDelay: number;
  revealed: boolean;
};

const margin = { top: 24, right: 14, bottom: 44, left: 52 };

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyBars({ rows, overallMeanDelay, revealed }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 560, h: CHART_HEIGHT_DEFAULT });
  const [showAvg, setShowAvg] = useState(false);
  const [hoverM, setHoverM] = useState<number | null>(null);

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

  useEffect(() => {
    if (!revealed) {
      setShowAvg(false);
      return;
    }
    const t = window.setTimeout(() => setShowAvg(true), 12 * 60 + 400);
    return () => clearTimeout(t);
  }, [revealed]);

  const layout = useMemo(() => {
    const w = size.w - margin.left - margin.right;
    const h = size.h - margin.top - margin.bottom;
    const maxDelay = d3.max(rows, (d) => d.mean_delay) ?? 25;
    const y = d3.scaleLinear().domain([0, maxDelay * 1.08]).range([h, 0]);
    const x = d3
      .scaleBand<number>()
      .domain(rows.map((d) => d.month))
      .range([0, w])
      .paddingInner(0.18);
    return { x, y, w, h };
  }, [rows, size]);

  const { x, y, w, h } = layout;

  const tip = useMemo(() => {
    if (hoverM == null || !Number.isFinite(hoverM)) return null;
    return rows.find((r) => r.month === hoverM) ?? null;
  }, [hoverM, rows]);

  const pointerMove = (evt: React.PointerEvent<SVGRectElement>) => {
    const svg = evt.currentTarget.ownerSVGElement;
    if (!svg) return;
    const layer = evt.currentTarget.parentElement as SVGGElement;
    const ctm = layer.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const mx = p.x;
    if (!Number.isFinite(mx)) {
      setHoverM(null);
      return;
    }
    for (const d of rows) {
      const x0 = x(d.month) ?? 0;
      const bw = x.bandwidth();
      if (mx >= x0 && mx <= x0 + bw) {
        setHoverM(d.month);
        return;
      }
    }
    setHoverM(null);
  };

  const showHover = hoverM != null && Number.isFinite(hoverM) && tip;
  const hoverCx = hoverM != null ? (x(hoverM) ?? 0) + x.bandwidth() / 2 : 0;

  return (
    <div ref={hostRef} className="chart-frame relative w-full overflow-hidden" onPointerLeave={() => setHoverM(null)}>
      <svg width={size.w} height={size.h} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map((t) => (
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
                {t.toFixed(0)}m
              </text>
            </g>
          ))}
          <line x1={0} x2={w} y1={h} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <line x1={0} x2={0} y1={h} y2={0} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          {showAvg && (
            <line
              x1={0}
              x2={w}
              y1={y(overallMeanDelay)}
              y2={y(overallMeanDelay)}
              stroke="var(--ink-soft)"
              strokeDasharray="5 4"
              strokeWidth={1.6}
              opacity={0}
            >
              <animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze" />
            </line>
          )}
          {showAvg && (
            <text
              x={w}
              y={y(overallMeanDelay) - 4}
              textAnchor="end"
              className="ui-label"
              fill="var(--ink-soft)"
              style={{ fontSize: TICK_FONT_PX }}
            >
              Average — {overallMeanDelay.toFixed(1)} min
            </text>
          )}
          {rows.map((d) => {
            const bw = x.bandwidth();
            const x0 = x(d.month) ?? 0;
            const otherVal = Math.max(0, d.mean_delay - d.mean_weather);
            const hOther = y(0) - y(otherVal);
            const hWeather = y(otherVal) - y(d.mean_delay);
            const isPulse = d.month === 6 || d.month === 7;
            const inner = (
              <g transform={`translate(${x0},0)`}>
                <motion.rect
                  x={0}
                  width={bw}
                  fill="var(--ink)"
                  initial={{ height: 0, y: h }}
                  animate={
                    revealed
                      ? {
                          height: hOther,
                          y: y(otherVal),
                        }
                      : { height: 0, y: h }
                  }
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: (d.month - 1) * 0.06 }}
                />
                <motion.rect
                  x={0}
                  width={bw}
                  fill="var(--bad)"
                  initial={{ height: 0, y: h }}
                  animate={
                    revealed
                      ? {
                          height: hWeather,
                          y: y(d.mean_delay),
                        }
                      : { height: 0, y: h }
                  }
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: (d.month - 1) * 0.06 + 0.04 }}
                />
              </g>
            );
            if (!isPulse) return <g key={d.month}>{inner}</g>;
            return (
              <motion.g
                key={d.month}
                initial={false}
                animate={revealed ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.8, delay: 0.85, times: [0, 0.45, 1] }}
                style={{ transformOrigin: `${x0 + bw / 2}px ${h}px` }}
              >
                {inner}
              </motion.g>
            );
          })}
          {revealed &&
            [6, 7].map((m) => {
              const d = rows.find((r) => r.month === m);
              if (!d) return null;
              const x0 = x(m) ?? 0;
              const bw = x.bandwidth();
              const label = `${d.mean_delay.toFixed(1)} min`;
              return (
                <text
                  key={`punch-${m}`}
                  x={x0 + bw / 2}
                  y={y(d.mean_delay) - 6}
                  textAnchor="middle"
                  className="fill-[var(--bad)]"
                  style={{
                    fontFamily: "Fraunces, Georgia, serif",
                    fontSize: 13,
                    fontStyle: "italic",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </text>
              );
            })}
          {showHover && hoverM != null && (
            <line
              x1={hoverCx}
              x2={hoverCx}
              y1={0}
              y2={h}
              stroke="var(--ink-soft)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          )}
          {rows.map((d) => {
            const x0 = x(d.month) ?? 0;
            return (
              <text
                key={`lab-${d.month}`}
                x={x0 + x.bandwidth() / 2}
                y={h + 28}
                textAnchor="middle"
                className="tick-label"
                fill={AXIS_TICK_FILL}
                style={{ fontSize: TICK_FONT_PX }}
              >
                {monthNames[d.month - 1]}
              </text>
            );
          })}
          <rect width={w} height={h} fill="transparent" onPointerMove={pointerMove} />
        </g>
      </svg>
      {showHover && tip && hoverM != null && (
        <div
          className="chart-tooltip pointer-events-none absolute z-20"
          style={{
            left: Math.max(8, Math.min(size.w - 200, margin.left + hoverCx - 72)),
            top: margin.top + 10,
          }}
        >
          <div className="ui-label font-semibold">{monthNames[tip.month - 1]}</div>
          <div>Total mean delay {tip.mean_delay.toFixed(1)} min</div>
          <div>Weather portion {tip.mean_weather.toFixed(1)} min</div>
        </div>
      )}
      <ChartLegend
        items={[
          { label: "Other delay (stacked base)", color: "var(--ink)" },
          { label: "Weather-attributed", color: "var(--bad)" },
        ]}
      />
    </div>
  );
}
