import * as d3 from "d3";
import { useEffect, useMemo, useState } from "react";
import scrollama from "scrollama";
import { AnimatedNumber } from "./components/AnimatedNumber";
import { Kicker } from "./components/Kicker";
import { Postscript } from "./components/Postscript";
import { ScrollSection } from "./components/ScrollSection";
import { IndustryPaddingChart } from "./components/charts/IndustryPaddingChart";
import { LineChart } from "./components/charts/LineChart";
import { MonthlyBars } from "./components/charts/MonthlyBars";
import { StackedCauseChart } from "./components/charts/StackedCauseChart";
import {
  compounding_stat,
  dow_delay_by_carrier,
  hourly_cause_share,
  logAggregationSamples,
  monthly_delay_breakdown,
  padding_by_carrier_year,
  tshourly_ontime_pct,
} from "./data/aggregations";
import { loadAllFlights } from "./data/loadFlights";
import type { FlightRow } from "./data/types";

let globalFlightLoadStarted = false;
let aggregationLogDone = false;

export default function App() {
  const [rows, setRows] = useState<FlightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (globalFlightLoadStarted) return;
    globalFlightLoadStarted = true;
    loadAllFlights()
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const sc = scrollama();
    sc
      .setup({
        step: ".story-step",
        offset: 0.25,
        progress: false,
      })
      .onStepEnter(() => undefined);
    const onResize = () => sc.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      sc.destroy();
    };
  }, []);

  const hourlyOntime = useMemo(() => (rows ? tshourly_ontime_pct(rows) : []), [rows]);
  const hourlyCause = useMemo(() => (rows ? hourly_cause_share(rows) : []), [rows]);
  const monthly = useMemo(() => (rows ? monthly_delay_breakdown(rows) : []), [rows]);
  const paddingByCarrierYear = useMemo(() => (rows ? padding_by_carrier_year(rows) : []), [rows]);
  const dowByCarrier = useMemo(() => (rows ? dow_delay_by_carrier(rows) : []), [rows]);
  const compounding = useMemo(
    () => (rows ? compounding_stat(rows) : { tue_6am_mean: 0, sun_8pm_mean: 0, n_tue: 0, n_sun: 0 }),
    [rows]
  );
  const overallMean = 11.2;

  useEffect(() => {
    if (!rows?.length || aggregationLogDone) return;
    aggregationLogDone = true;
    logAggregationSamples(hourlyOntime, hourlyCause, monthly, paddingByCarrierYear);
    const dowMon0 = (dateStr: string) => {
      const [mm, dd, yyyy] = dateStr.split("/").map((v) => Number.parseInt(v, 10));
      if (!mm || !dd || !yyyy) return NaN;
      const js = new Date(Date.UTC(yyyy, mm - 1, dd)).getUTCDay();
      return (js + 6) % 7;
    };
    const dowOverall = d3
      .rollups(
        rows,
        (v) => d3.mean(v, (d) => d.dep_delay_min) ?? 0,
        (d) => dowMon0(d.date)
      )
      .sort((a, b) => a[0] - b[0])
      .map(([dow, mean]) => ({ dow, day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow]!, mean: +mean.toFixed(2) }));
    const byCarrierTable = dowByCarrier.map((r) => ({ day: r.dow_name, carrier: r.carrier, mean: r.mean_delay, n: r.n }));
    const ratio = compounding.tue_6am_mean > 0 ? compounding.sun_8pm_mean / compounding.tue_6am_mean : 0;
    console.group("[TPA delays] Story IV postscript sanity");
    console.table(dowOverall);
    console.table(byCarrierTable);
    console.table({
      tue_6am_mean: +compounding.tue_6am_mean.toFixed(2),
      sun_8pm_mean: +compounding.sun_8pm_mean.toFixed(2),
      ratio: +ratio.toFixed(2),
      n_tue: compounding.n_tue,
      n_sun: compounding.n_sun,
    });
    console.groupEnd();
  }, [rows, hourlyOntime, hourlyCause, monthly, paddingByCarrierYear, dowByCarrier, compounding]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-[var(--bad)]">Could not load data: {error}</p>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <div className="h-3 w-64 max-w-full rounded shimmer" />
        <div className="h-3 w-48 max-w-full rounded shimmer" />
        <p className="mono-strip text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
          Loading Bureau of Transportation Statistics extracts
        </p>
      </div>
    );
  }

  return (
    <>
      <div aria-hidden className="flight-bg-layer">
        <img src="/images/plane-bg.png" alt="" className="flight-bg-plane plane-a" />
        <img src="/images/plane-bg.png" alt="" className="flight-bg-plane plane-b" />
        <img src="/images/plane-bg.png" alt="" className="flight-bg-plane plane-c" />
        <img src="/images/plane-bg.png" alt="" className="flight-bg-plane plane-d" />
        <img src="/images/plane-bg.png" alt="" className="flight-bg-plane plane-e" />
      </div>
      <article className="relative z-10 mx-auto max-w-[1360px] px-4 pb-24 pt-2 sm:px-6 min-[980px]:px-10">
      <header className="masthead border-b border-[var(--rule)] pb-6 pt-3">
        <div className="masthead-top masthead-strip mono-strip mb-4 flex w-full flex-wrap items-center gap-x-10 gap-y-1 px-5 py-2">
          <span>Tampa International (TPA)</span>
          <span>Departures 2020–2025</span>
          <span>American · Delta · Southwest</span>
          <span>277,000 departures</span>
        </div>
        <h1 className="headline max-w-none text-[clamp(2.05rem,4.2vw,3.85rem)] leading-[1.06] tracking-[-0.015em] min-[1220px]:whitespace-nowrap">
          Three lies your flight stats are telling you
        </h1>
        <p className="deck mt-3 max-w-[72ch] italic">
          The industry loves a single <span className="text-emph-lie">average delay</span>. At TPA, that average
          hides three different stories in the same numbers.
        </p>
        <div className="byline mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ink-2)]">
          <span>
            By <strong>Naga Pavan Sathvik Reddy Sirigiri</strong>
          </span>
          <span className="dot">·</span>
          <span>ISM 6419: Data Visualization for Storytelling</span>
          <span className="dot">·</span>
          <span>Data: U.S. Bureau of Transportation Statistics</span>
          <span className="dot">·</span>
          <a
            href="https://www.youtube.com/watch?v=dDPtj7ZNVYc"
            target="_blank"
            rel="noopener noreferrer"
            className="byline-video-link"
          >
            ▶ Watch the walkthrough
          </a>
        </div>
      </header>

      <section className="story-step lede border-b border-[var(--rule)] py-10 min-[860px]:grid min-[860px]:grid-cols-[minmax(440px,1.15fr)_minmax(280px,0.85fr)] min-[860px]:items-center min-[860px]:gap-x-12 min-[980px]:gap-x-14 min-[980px]:py-14">
        <div className="min-w-0 max-w-[520px]">
          <p className="drop-cap text-[1.08rem] leading-[1.48] text-[var(--ink-2)]">
            Every airline at Tampa International advertises the same thing: we run on time. American, Delta, and
            Southwest each report an average departure delay so small it looks reassuring,{" "}
            <span className="font-semibold text-[var(--ink)]">
              <AnimatedNumber end={11.2} durationMs={1200} decimals={1} suffix=" minutes" />
            </span>{" "}
            .
          </p>
          <p className="mt-3 text-[var(--ink-2)] leading-[1.5]">
            But averages hide more than they show. Six years of flight records, 277,000 departures from TPA, reveal
            three different stories the airlines would rather you not notice. Each one can double or halve the delay
            you actually face.
          </p>
          <p className="mt-3 text-[var(--ink-2)] leading-[1.5]">
            Where you fly matters less than you think. When you fly matters more.
          </p>
        </div>
        <div className="mt-8 flex flex-col items-start justify-center min-[860px]:mt-0 min-[860px]:self-center">
          <div className="stat-giant text-[clamp(4rem,9vw,7rem)]">
            <AnimatedNumber end={overallMean} durationMs={1200} decimals={1} />
            <span className="align-top text-[0.35em] font-normal text-[var(--ink-soft)]">min</span>
          </div>
          <p className="mono-strip mt-2 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            Mean departure delay · all carriers
          </p>
        </div>
      </section>

      <section className="story-step section panel-hourly border-b border-[var(--rule)] py-12 min-[980px]:grid min-[980px]:grid-cols-[380px_minmax(0,1fr)] min-[980px]:items-start min-[980px]:gap-10 min-[980px]:py-16">
        <div className="min-w-0 max-w-[380px]">
          <h2 className="section-head">
            The <span className="italic text-[var(--bad)]">earlier</span> you fly, the more likely you are to leave on
            time.
          </h2>
          <p className="text-[var(--ink-2)]">
            A flight scheduled for 6 AM at Tampa leaves on time 83% of the time. A flight scheduled for 8 PM leaves
            on time only 48%, your odds of leaving on time nearly cut in half across one day. All three carriers show
            the same pattern.
          </p>
          <p className="mt-5 text-[var(--ink-2)]">
            Why does the day get worse? Because delays carry forward. Look at the right chart. The orange band, flights
            that were late because the same plane was already late from its previous trip, grows from 14% of all delay
            minutes at 6 AM to 69% by 8 PM. One late morning flight breaks the next five.
          </p>
          <blockquote className="mt-6 border-l-[3px] border-[var(--bad)] pl-4 font-serif text-[1.08rem] italic leading-snug text-[var(--bad)]">
            &ldquo;It&apos;s not the airline you pick. It&apos;s the hour you pick.&rdquo;
          </blockquote>
          <aside className="summary-card mt-4 w-full border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 text-[0.95rem] leading-relaxed text-[var(--ink-2)]">
            <span className="ui-label text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-soft)]">
              Takeaway
            </span>
            <p className="mt-1.5">
              A morning flight is on time nearly twice as often as an evening flight on the same airline. The reason is
              the cascade, delays compound across each plane&apos;s 5–6 daily legs. Book early.
            </p>
          </aside>
        </div>
        <div className="mt-8 min-[980px]:sticky min-[980px]:top-8 min-[980px]:mt-0">
          <ScrollSection>
            {({ revealed }) => (
              <>
                <div className="vis vis-paired">
                  <div className="vis-chart-left">
                    <h4 className="vis-chart-label">What: on-time % by hour</h4>
                    <LineChart rows={hourlyOntime} revealed={revealed} compact showXAxisLabel={false} />
                  </div>
                  <div className="vis-chart-right">
                    <h4 className="vis-chart-label">Why: cause composition</h4>
                    <StackedCauseChart rows={hourlyCause} revealed={revealed} compact showXAxisLabel={false} />
                  </div>
                  <div className="vis-shared-axis ui-label">Scheduled hour (local)</div>
                </div>
                <div className="vis-stat-strip">
                  <div className="vis-stat">
                    <div className="vis-stat-num">83%</div>
                    <div className="vis-stat-label">on-time at 6 AM</div>
                  </div>
                  <div className="vis-stat">
                    <div className="vis-stat-num bad">48%</div>
                    <div className="vis-stat-label">on-time at 8 PM</div>
                  </div>
                  <div className="vis-stat">
                    <div className="vis-stat-num bad">69%</div>
                    <div className="vis-stat-label">evening delay inherited</div>
                  </div>
                </div>
              </>
            )}
          </ScrollSection>
        </div>
      </section>

      <section className="story-step section panel-monthly border-b border-[var(--rule)] py-12 min-[980px]:grid min-[980px]:grid-cols-[380px_minmax(0,1fr)] min-[980px]:items-start min-[980px]:gap-10 min-[980px]:py-16">
        <div className="min-w-0 max-w-[380px]">
          <h2 className="section-head">
            <span className="italic text-[var(--bad)]">July</span> is the worst month to fly Tampa. Not December.
          </h2>
          <p className="text-[var(--ink-2)]">
            Most travelers brace for Christmas-week delays. They&apos;re bracing for the wrong month.
          </p>
          <p className="mt-5 text-[var(--ink-2)]">
            December&apos;s average delay at Tampa is 11.2 minutes, right at the yearly average. July&apos;s is 19
            minutes, and June is barely behind. The summer months are roughly three times worse than the fall.
          </p>
          <p className="mt-5 text-[var(--ink-2)]">
            The reason is sitting overhead. Tampa is on the Gulf Coast, where summer afternoons bring daily
            thunderstorms. Weather-attributed delay in summer is 9 times higher than in fall. The storms slow the
            morning down, and the cascade from earlier does the rest.
          </p>
          <blockquote className="mt-6 border-l-[3px] border-[var(--bad)] pl-4 font-serif text-[1.08rem] italic leading-snug text-[var(--bad)]">
            &ldquo;Summer at Tampa isn&apos;t a vacation. It&apos;s a delay event tourists walk into.&rdquo;
          </blockquote>
        </div>
        <div className="mt-8 min-[980px]:sticky min-[980px]:top-8 min-[980px]:mt-0">
          <ScrollSection>
            {({ revealed }) => (
              <MonthlyBars rows={monthly} overallMeanDelay={overallMean} revealed={revealed} />
            )}
          </ScrollSection>
          <div className="takeaway takeaway-below-chart">
            <div className="takeaway-label">TAKEAWAY</div>
            <p>
              If your trip is flexible, fly in October or November. The average delay is one-third of July&apos;s.
              December is fine. Only the days right around New Year&apos;s spike.
            </p>
          </div>
        </div>
      </section>

      <section className="story-step section panel-padding border-b border-[var(--rule)] py-12 min-[980px]:grid min-[980px]:grid-cols-[380px_minmax(0,1fr)] min-[980px]:items-start min-[980px]:gap-10 min-[980px]:py-16">
        <div className="min-w-0 max-w-[380px]">
          <h2 className="section-head">
            Airlines <span className="italic text-[var(--bad)]">padded their schedules</span> in 2020 to look on time.
            Now they&apos;ve cut it back.
          </h2>
          <p className="text-[var(--ink-2)]">
            Here&apos;s the part nobody tells you. A flight is &quot;on time&quot; if it arrives within the airline&apos;s
            scheduled flight time, but the airline picks that number.
          </p>
          <p className="mt-5 text-[var(--ink-2)]">
            In 2020, with empty skies during COVID, all three Tampa airlines built generous cushions into their
            schedules. American padded by{" "}
            <AnimatedNumber end={13} durationMs={1200} decimals={0} suffix=" minutes" className="font-semibold text-[var(--ink)]" />.
            Delta by{" "}
            <AnimatedNumber end={14} durationMs={1200} decimals={0} suffix=" minutes" className="font-semibold text-[var(--ink)]" />.
            Southwest by{" "}
            <AnimatedNumber end={19} durationMs={1200} decimals={0} suffix=" minutes" className="font-semibold text-[var(--ink)]" />.
            The plane only needed two hours, but the schedule said two-and-a-half. That made on-time stats look great.
          </p>
          <p className="mt-5 text-[var(--ink-2)]">
            By 2025, all three airlines had quietly cut the padding to about{" "}
            <AnimatedNumber end={7} durationMs={1200} decimals={0} suffix=" minutes" className="font-semibold text-[var(--ink)]" />.
            The aircraft didn&apos;t get faster. The schedules just got honest.
          </p>
          <blockquote className="mt-6 border-l-[3px] border-[var(--bad)] pl-4 font-serif text-[1.08rem] italic leading-snug text-[var(--bad)]">
            &ldquo;The schedule isn&apos;t a prediction. It&apos;s a number every airline can move.&rdquo;
          </blockquote>
        </div>
        <div className="mt-8 min-[980px]:mt-0">
          <ScrollSection>
            {({ revealed }) => <IndustryPaddingChart rows={paddingByCarrierYear} revealed={revealed} />}
          </ScrollSection>
          <div className="takeaway takeaway-below-chart">
            <div className="takeaway-label">WHY THIS MATTERS</div>
            <p>
              A 2025 on-time rate that looks worse than 2020&apos;s might just mean more honest schedules, not worse
              operations. Year-over-year comparisons are apples-to-oranges across the whole industry.
            </p>
          </div>
        </div>
      </section>

      <Postscript dowRows={dowByCarrier} />

      <Kicker />

      <footer className="footer-note border-t border-[var(--rule)] pt-8">
        <p>
          Source: U.S. DOT Bureau of Transportation Statistics, TPA departure detail files (American, Delta, Southwest),
          2020–2025. Rows with invalid dates or missing delay / block times dropped. Cause shares use attributed delay
          minutes among positive-delay departures only. Padding chart: mean (scheduled − actual) block time by calendar
          year and carrier, all destinations.
        </p>
      </footer>
      </article>
    </>
  );
}
