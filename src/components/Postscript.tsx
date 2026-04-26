import { AnimatedNumber } from "./AnimatedNumber";
import { PanelDayOfWeek } from "./PanelDayOfWeek";
import type { DayOfWeekDelayRow } from "../data/aggregations";

type Props = {
  dowRows: DayOfWeekDelayRow[];
};

export function Postscript({ dowRows }: Props) {
  return (
    <section
      id="postscript"
      className="story-step section postscript border-b border-[var(--rule)] py-12 min-[980px]:grid min-[980px]:grid-cols-[380px_minmax(0,1fr)] min-[980px]:items-start min-[980px]:gap-10 min-[980px]:py-16"
    >
      <div className="min-w-0 max-w-[380px]">
        <p className="mono-strip mb-4 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          POSTSCRIPT &nbsp; &#8212;&#8212;&#8212;&#8212;&#8212; &nbsp; WHAT THE DATA HAS BEEN QUIETLY SAYING
        </p>
        <h2 className="section-head">
          <span className="italic text-[var(--bad)]">Tuesday</span> is the best day to fly Tampa, at every airline.
        </h2>
        <p className="drop-cap text-[var(--ink-2)]">
          One more pattern hides in plain sight, and it&apos;s the easiest to act on.
        </p>
        <p className="mt-5 text-[var(--ink-2)]">
          A Tampa flight on Tuesday averages{" "}
          <span className="font-semibold text-[var(--ink)]">
            <AnimatedNumber end={8} decimals={0} durationMs={1200} /> minutes
          </span>
          {" "}of delay. The same flight on Sunday averages{" "}
          <span className="font-semibold text-[var(--ink)]">
            <AnimatedNumber end={13} decimals={0} durationMs={1200} /> minutes
          </span>
          . Tuesday is the best day at every airline in the dataset. American, Delta, and Southwest all agree.
        </p>
        <p className="mt-5 text-[var(--ink-2)]">
          But the real punch is what happens when the patterns stack. A Tuesday 6 AM flight averages{" "}
          <span className="font-semibold text-[var(--ink)]">
            <AnimatedNumber end={3} decimals={0} durationMs={1200} /> minutes
          </span>
          . A Sunday 8 PM flight averages{" "}
          <span className="font-semibold text-[var(--ink)]">
            <AnimatedNumber end={23} decimals={0} durationMs={1200} /> minutes
          </span>
          . That is a{" "}
          <span className="font-semibold text-[var(--ink)]">
            <AnimatedNumber end={7} decimals={0} durationMs={1200} />×
          </span>{" "}
          difference. The lies don&apos;t add together. They multiply.
        </p>
        <blockquote className="mt-6 border-l-[3px] border-[var(--bad)] pl-4 font-serif text-[1.08rem] italic leading-snug text-[var(--bad)]">
          &ldquo;When the lies stack, they don&apos;t add. They multiply.&rdquo;
        </blockquote>
        <p className="mt-5 text-[var(--ink-2)]">
          If you can&apos;t change your hour or your month, change your day. Tuesday is the cheapest schedule decision
          a traveler can make. Three lies in one statistic, and when you know what to look for, the compounding shows
          everywhere.
        </p>
      </div>
      <div className="mt-8 min-[980px]:sticky min-[980px]:top-8 min-[980px]:mt-0">
        <PanelDayOfWeek rows={dowRows} />
        <div className="compound-card takeaway-below-chart">
          <div className="compound-label">THE COMPOUND</div>
          <div className="compound-rows">
            <div className="compound-row">
              <span className="label">Tuesday 6 AM</span>
              <span className="value">
                <AnimatedNumber end={3} decimals={0} durationMs={1200} /> min
              </span>
            </div>
            <div className="compound-row">
              <span className="label">Sunday 8 PM</span>
              <span className="value">
                <AnimatedNumber end={23} decimals={0} durationMs={1200} /> min
              </span>
            </div>
          </div>
          <div className="compound-summary">
            <strong>
              <AnimatedNumber end={7} decimals={0} durationMs={1200} />×
            </strong>
            <span className="compound-summary-text">
              difference &#8212; same airport, same airlines, same passengers.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
