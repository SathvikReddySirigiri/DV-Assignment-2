export function Kicker() {
  return (
    <section className="kicker">
      <div className="kicker-grid">
        <div className="kicker-prose">
          <p className="kicker-lede">So how late will your flight be?</p>

          <p>
            It depends on three things the average hides: <strong>what hour you fly</strong>,{" "}
            <strong>what month you fly</strong>, and{" "}
            <strong>how much cushion the airline put in your schedule</strong>. Any one of them can double or halve
            your wait. Together, they explain almost everything.
          </p>

          <p>
            The airlines aren&apos;t lying. They&apos;re just averaging, and a single number across{" "}
            <strong>277,000 flights</strong> can never answer one passenger&apos;s question.{" "}
            <em>Averages smooth. Stories specify.</em>
          </p>
        </div>

        <aside className="kicker-card">
          <div className="kicker-card-label">THREE LIES IN ONE STATISTIC</div>
          <ol className="kicker-card-list">
            <li>
              The 6 AM flight is on time <strong>83%</strong> of the time. The 8 PM flight, <strong>48%</strong>. The
              average tells you neither.
            </li>
            <li>
              July&apos;s average delay is <strong>3×</strong> October&apos;s. The yearly average papers over an entire
              bad summer.
            </li>
            <li>
              Airlines cut <strong>6–12 minutes</strong> of padding from their schedules since 2020. The same on-time
              rate means something different today than it did then.
            </li>
          </ol>
          <a href="#postscript" className="kicker-card-footnote">
            And one more pattern the data quietly revealed. Keep scrolling. ↓
          </a>
        </aside>
      </div>
    </section>
  );
}
