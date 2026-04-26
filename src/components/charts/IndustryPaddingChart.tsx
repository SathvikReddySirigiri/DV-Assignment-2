import * as d3 from "d3";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PaddingCarrierYearRow } from "../../data/aggregations";
import type { CarrierName } from "../../data/types";
import {
  AXIS_LABEL_PX,
  AXIS_STROKE,
  AXIS_STROKE_WIDTH,
  AXIS_TICK_FILL,
  AXIS_TICK_STROKE_WIDTH,
  CHART_HEIGHT_PADDING,
  CHART_MIN_WIDTH,
  LINE_STROKE,
  TICK_FONT_PX,
} from "./chartLayout";
import { ChartLegend } from "./ChartLegend";

type Props = {
  rows: PaddingCarrierYearRow[];
  revealed: boolean;
};

const CARRIERS: CarrierName[] = ["American", "Delta", "Southwest"];
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

const margin = { top: 32, right: 104, bottom: 52, left: 64 };
const YEAR0 = 2020;
const YEAR1 = 2025;

export function IndustryPaddingChart({ rows, revealed }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Partial<Record<CarrierName, SVGPathElement | null>>>({});
  const [size, setSize] = useState({ w: 600, h: CHART_HEIGHT_PADDING });
  const [lengths, setLengths] = useState<Record<CarrierName, number>>({
    American: 800,
    Delta: 800,
    Southwest: 800,
  });
  const [dashOff, setDashOff] = useState<Record<CarrierName, number>>({
    American: 800,
    Delta: 800,
    Southwest: 800,
  });
  const [bandOp, setBandOp] = useState(0);
  const [dotsOp, setDotsOp] = useState(0);
  const [bracketOp, setBracketOp] = useState(0);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(CHART_MIN_WIDTH, r.width), h: CHART_HEIGHT_PADDING });
    });
    ro.observe(el);
    setSize({
      w: Math.max(CHART_MIN_WIDTH, hostRef.current?.getBoundingClientRect().width ?? 600),
      h: CHART_HEIGHT_PADDING,
    });
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const w = size.w - margin.left - margin.right;
    const h = size.h - margin.top - margin.bottom;
    const pad = (c: CarrierName, y: number) => rows.find((r) => r.carrier === c && r.year === y)?.padding ?? NaN;

    if (!rows.length) {
      const x = d3.scaleLinear().domain([YEAR0, YEAR1]).range([0, w]);
      const y = d3.scaleLinear().domain([0, 22]).range([h, 0]);
      return {
        x,
        y,
        w,
        h,
        paths: { American: "", Delta: "", Southwest: "" } as Record<CarrierName, string>,
        bandD: "",
        pad,
        spread2020: 0,
        spread2025: 0,
        min2020: 0,
        max2020: 0,
        min2025: 0,
        max2025: 0,
      };
    }

    const years = d3.range(YEAR0, YEAR1 + 1);
    const x = d3.scaleLinear().domain([YEAR0, YEAR1]).range([0, w]);
    const y = d3.scaleLinear().domain([0, 22]).range([h, 0]).nice();

    const series = CARRIERS.map((c) => ({
      carrier: c,
      points: years.map((yr) => ({ year: yr, padding: pad(c, yr) })).filter((p) => Number.isFinite(p.padding)),
    }));

    const gen = d3
      .line<{ year: number; padding: number }>()
      .defined((d) => Number.isFinite(d.padding))
      .x((d) => x(d.year))
      .y((d) => y(d.padding))
      .curve(d3.curveMonotoneX);

    const paths: Record<CarrierName, string> = {
      American: "",
      Delta: "",
      Southwest: "",
    };
    for (const s of series) {
      paths[s.carrier] = s.points.length ? gen(s.points) ?? "" : "";
    }

    const bandUpper = years.map((yr) => {
      const vals = CARRIERS.map((c) => pad(c, yr)).filter((v) => Number.isFinite(v));
      return { year: yr, v: vals.length ? Math.max(...vals) : 0 };
    });
    const bandLower = years.map((yr) => {
      const vals = CARRIERS.map((c) => pad(c, yr)).filter((v) => Number.isFinite(v));
      return { year: yr, v: vals.length ? Math.min(...vals) : 0 };
    });

    let bandD = "";
    if (bandUpper.every((p) => Number.isFinite(p.v))) {
      const top = bandUpper.map((p) => [x(p.year), y(p.v)] as const);
      const bot = bandLower.map((p) => [x(p.year), y(p.v)] as const).reverse();
      bandD = `M${top[0]![0]},${top[0]![1]}` + top.slice(1).map((p) => `L${p[0]},${p[1]}`).join("");
      bandD += bot.map((p) => `L${p[0]},${p[1]}`).join("") + "Z";
    }

    const p2020 = CARRIERS.map((c) => pad(c, 2020)).filter(Number.isFinite);
    const p2025 = CARRIERS.map((c) => pad(c, 2025)).filter(Number.isFinite);
    const spread2020 = p2020.length ? Math.max(...p2020) - Math.min(...p2020) : 0;
    const spread2025 = p2025.length ? Math.max(...p2025) - Math.min(...p2025) : 0;
    const min2020 = p2020.length ? Math.min(...p2020) : 0;
    const max2020 = p2020.length ? Math.max(...p2020) : 0;
    const min2025 = p2025.length ? Math.min(...p2025) : 0;
    const max2025 = p2025.length ? Math.max(...p2025) : 0;

    return {
      x,
      y,
      w,
      h,
      paths,
      bandD,
      pad,
      spread2020,
      spread2025,
      min2020,
      max2020,
      min2025,
      max2025,
    };
  }, [rows, size]);

  const { x, y, w, h, paths, bandD, pad, spread2020, spread2025, min2020, max2020, min2025, max2025 } = layout;

  useLayoutEffect(() => {
    const L: Record<CarrierName, number> = { American: 800, Delta: 800, Southwest: 800 };
    for (const c of CARRIERS) {
      const p = pathRefs.current[c];
      L[c] = p?.getTotalLength() ?? 800;
    }
    setLengths(L);
    if (!revealed) setDashOff({ ...L });
  }, [revealed, paths, w, h]);

  useEffect(() => {
    if (!revealed) {
      setBandOp(0);
      setDotsOp(0);
      setBracketOp(0);
      return;
    }
    let cancelled = false;
    const L: Record<CarrierName, number> = { American: 800, Delta: 800, Southwest: 800 };
    for (const c of CARRIERS) {
      const p = pathRefs.current[c];
      L[c] = p?.getTotalLength() ?? 800;
    }
    setLengths(L);
    setDashOff({ ...L });

    const lineDur = 2000;
    const bandDur = 600;
    const bracketFade = 1000;
    const t0 = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const el = now - t0;
      const lineT = Math.min(1, el / lineDur);
      const lineE = d3.easeCubicOut(lineT);
      setDashOff({
        American: L.American * (1 - lineE),
        Delta: L.Delta * (1 - lineE),
        Southwest: L.Southwest * (1 - lineE),
      });

      if (el >= lineDur) {
        setDotsOp(Math.min(1, (el - lineDur) / 300));
      } else {
        setDotsOp(0);
      }

      if (el >= lineDur) {
        const bT = Math.min(1, (el - lineDur) / bandDur);
        setBandOp(d3.easeCubicOut(bT));
      } else setBandOp(0);

      if (el >= lineDur + bandDur) {
        const aT = Math.min(1, (el - lineDur - bandDur) / bracketFade);
        setBracketOp(d3.easeCubicOut(aT));
      } else setBracketOp(0);

      if (el < lineDur + bandDur + bracketFade + 50) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [revealed]);

  useEffect(() => {
    if (!revealed) setHoverYear(null);
  }, [revealed]);

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
    const raw = x.invert(p.x);
    const yr = Math.round(raw);
    if (!Number.isFinite(yr)) {
      setHoverYear(null);
      return;
    }
    setHoverYear(Math.max(YEAR0, Math.min(YEAR1, yr)));
  };

  const tip = useMemo(() => {
    if (hoverYear == null || !Number.isFinite(hoverYear)) return null;
    return CARRIERS.map((c) => ({
      c,
      v: rows.find((r) => r.carrier === c && r.year === hoverYear)?.padding ?? NaN,
    }));
  }, [hoverYear, rows]);

  const xTicks = [2020, 2021, 2022, 2023, 2024, 2025];

  const showTooltip = hoverYear != null && Number.isFinite(hoverYear) && tip != null;

  if (!rows.length) {
    return (
      <div ref={hostRef} className="chart-frame px-4 py-6 text-sm text-[var(--ink-soft)]">
        No padding rows to chart.
      </div>
    );
  }

  const cx2020 = x(2020);
  const cx2025 = x(2025);

  return (
    <div
      ref={hostRef}
      className="chart-frame relative w-full overflow-hidden"
      onPointerLeave={() => setHoverYear(null)}
    >
      <svg width={size.w} height={size.h} className="block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="var(--rule-soft)" strokeWidth={1} />
              <text
                x={-10}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                className="tick-label"
                fill={AXIS_TICK_FILL}
                style={{ fontSize: TICK_FONT_PX }}
              >
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={t} transform={`translate(${x(t)},${h})`}>
              <line y2={8} stroke={AXIS_STROKE} strokeWidth={AXIS_TICK_STROKE_WIDTH} />
              <text y={26} textAnchor="middle" className="tick-label" fill={AXIS_TICK_FILL} style={{ fontSize: TICK_FONT_PX }}>
                {t}
              </text>
            </g>
          ))}
          <line x1={0} x2={w} y1={h} y2={h} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <line x1={0} x2={0} y1={h} y2={0} stroke={AXIS_STROKE} strokeWidth={AXIS_STROKE_WIDTH} />
          <text
            transform="rotate(-90)"
            x={-h / 2}
            y={-44}
            textAnchor="middle"
            className="ui-label fill-[var(--ink-soft)]"
            style={{ fontSize: AXIS_LABEL_PX }}
          >
            Padding (min)
          </text>

          {bandD ? (
            <path
              d={bandD}
              fill="var(--highlight)"
              fillOpacity={0.45 * bandOp}
              stroke="none"
              style={{ transition: "none" }}
            />
          ) : null}

          {CARRIERS.map((c) => {
            const len = lengths[c] || 800;
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
                strokeLinejoin="round"
                strokeDasharray={`${len} ${len}`}
                strokeDashoffset={dashOff[c]}
              />
            );
          })}

          {showTooltip && hoverYear != null && (
            <line
              x1={x(hoverYear)}
              x2={x(hoverYear)}
              y1={0}
              y2={h}
              stroke="var(--ink-soft)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          )}
          <rect width={w} height={h} fill="transparent" onPointerMove={pointerMove} />
        </g>

        {/* 2020 / 2025 callouts: anchored on year tick (center), text below spread */}
        <g
          opacity={bracketOp}
          className="pointer-events-none"
          transform={`translate(${margin.left},${margin.top})`}
        >
          <g transform={`translate(${cx2020},0)`}>
            <line x1={0} x2={0} y1={y(max2020)} y2={y(min2020)} stroke="var(--ink-2)" strokeWidth={1.2} />
            <line x1={-8} x2={0} y1={y(max2020)} y2={y(max2020)} stroke="var(--ink-2)" strokeWidth={1.2} />
            <line x1={-8} x2={0} y1={y(min2020)} y2={y(min2020)} stroke="var(--ink-2)" strokeWidth={1.2} />
            {/* Spread callout moved above plot area */}
            <text
              x={0}
              y={-10}
              textAnchor="middle"
              className="ui-label"
              fill="var(--ink-2)"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              13–19 min spread
            </text>
            <line x1={0} x2={0} y1={-4} y2={y(max2020) - 6} stroke="var(--ink-2)" strokeWidth={1} />
          </g>
        </g>
      </svg>

      {showTooltip && tip && hoverYear != null && Number.isFinite(hoverYear) && (
        <div
          className="chart-tooltip pointer-events-none absolute z-20 max-w-[240px] px-3 py-2 shadow-md"
          style={{
            left: Math.max(8, Math.min(size.w - 232, margin.left + x(hoverYear) - 60)),
            top: margin.top + 8,
            fontFamily: "Fraunces, Georgia, serif",
            fontStyle: "italic",
          }}
        >
          <div className="mb-1 text-[12px] not-italic" style={{ fontFamily: "Inter Tight, sans-serif", fontStyle: "normal" }}>
            {hoverYear}
          </div>
          {tip.map(({ c, v }) => (
            <div key={c} className="flex justify-between gap-4 text-[13px]">
              <span style={{ color: COLORS[c] }}>{LABELS[c]}</span>
              <span>{Number.isFinite(v) ? `${v.toFixed(1)} min` : "—"}</span>
            </div>
          ))}
        </div>
      )}

      {revealed && (
        <div className="pointer-events-none mt-3 px-3 text-center text-[12px] text-[var(--ink-soft)] ui-label">
          Spread {spread2020.toFixed(0)} min (2020) → {spread2025.toFixed(0)} min (2025)
        </div>
      )}

      <ChartLegend
        items={[
          { label: "American", color: "var(--carrier-american)" },
          { label: "Delta", color: "var(--carrier-delta)" },
          { label: "Southwest", color: "var(--carrier-southwest)" },
        ]}
      />
    </div>
  );
}
