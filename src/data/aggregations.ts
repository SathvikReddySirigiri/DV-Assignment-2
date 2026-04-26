import * as d3 from "d3";
import { isOntimeDeparture } from "./loadFlights";
import type { CarrierName, FlightRow } from "./types";

export type HourlyOntimeRow = { hour: number; carrier: CarrierName; pct_ontime: number; n: number };

export function tshourly_ontime_pct(rows: FlightRow[]): HourlyOntimeRow[] {
  const byHourCarrier = d3.group(
    rows.filter((r) => r.sched_hour >= 5 && r.sched_hour <= 21),
    (r) => r.sched_hour,
    (r) => r.carrier
  );
  const out: HourlyOntimeRow[] = [];
  for (const [hour, carrierMap] of byHourCarrier) {
    for (const [carrier, rs] of carrierMap) {
      const n = rs.length;
      if (n < 50) continue;
      const ontime = rs.filter((r) => isOntimeDeparture(r.dep_delay_min)).length;
      out.push({ hour, carrier, pct_ontime: (100 * ontime) / n, n });
    }
  }
  return out.sort((a, b) => a.hour - b.hour || a.carrier.localeCompare(b.carrier));
}

export type HourlyCauseShareRow = {
  hour: number;
  weather: number;
  nas: number;
  carrier: number;
  late_aircraft: number;
};

export function hourly_cause_share(rows: FlightRow[]): HourlyCauseShareRow[] {
  const lateRows = rows.filter((r) => r.dep_delay_min > 0);
  const byHour = d3.group(lateRows, (r) => r.sched_hour);
  const out: HourlyCauseShareRow[] = [];
  for (const [hour, rs] of byHour) {
    let w = 0,
      n = 0,
      c = 0,
      l = 0;
    for (const r of rs) {
      w += r.cause_weather_min;
      n += r.cause_nas_min;
      c += r.cause_carrier_min;
      l += r.cause_late_aircraft_min;
    }
    const tot = w + n + c + l;
    if (tot <= 0) continue;
    out.push({
      hour,
      weather: (100 * w) / tot,
      nas: (100 * n) / tot,
      carrier: (100 * c) / tot,
      late_aircraft: (100 * l) / tot,
    });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

export type MonthlyDelayRow = { month: number; mean_delay: number; mean_weather: number };

export function monthly_delay_breakdown(rows: FlightRow[]): MonthlyDelayRow[] {
  const byMonth = d3.group(rows, (r) => Number.parseInt(r.date.split("/")[0]!, 10));
  const out: MonthlyDelayRow[] = [];
  for (const [month, rs] of byMonth) {
    if (!month || month < 1 || month > 12) continue;
    const mean_delay = d3.mean(rs, (r) => r.dep_delay_min) ?? 0;
    const mean_weather = d3.mean(rs, (r) => r.cause_weather_min) ?? 0;
    out.push({ month, mean_delay, mean_weather });
  }
  return out.sort((a, b) => a.month - b.month);
}

export type PaddingCarrierYearRow = {
  year: number;
  carrier: CarrierName;
  padding: number;
  n: number;
};

export type DayOfWeekDelayRow = {
  dow: number;
  dow_name: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  carrier: CarrierName;
  mean_delay: number;
  n: number;
};

/** Mean schedule padding (scheduled − actual block) by calendar year and carrier, all TPA departures. */
export function padding_by_carrier_year(rows: FlightRow[]): PaddingCarrierYearRow[] {
  const grouped = d3.rollup(
    rows,
    (v) => ({
      padding: d3.mean(v, (d) => d.sched_elapsed_min - d.actual_elapsed_min) ?? 0,
      n: v.length,
    }),
    (d) => Number.parseInt(d.date.split("/")[2]!, 10),
    (d) => d.carrier
  );

  const result: PaddingCarrierYearRow[] = [];
  for (const [year, byCarrier] of grouped) {
    if (!Number.isFinite(year)) continue;
    for (const [carrier, stats] of byCarrier) {
      result.push({ year, carrier, padding: +stats.padding.toFixed(2), n: stats.n });
    }
  }
  return result.sort((a, b) => a.year - b.year || a.carrier.localeCompare(b.carrier));
}

function dowMon0(dateStr: string): number {
  const [mm, dd, yyyy] = dateStr.split("/").map((v) => Number.parseInt(v, 10));
  if (!mm || !dd || !yyyy) return NaN;
  const js = new Date(Date.UTC(yyyy, mm - 1, dd)).getUTCDay();
  return (js + 6) % 7;
}

export function dow_delay_by_carrier(rows: FlightRow[]): DayOfWeekDelayRow[] {
  const dowName: DayOfWeekDelayRow["dow_name"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const grouped = d3.rollup(
    rows,
    (v) => ({
      mean_delay: d3.mean(v, (d) => d.dep_delay_min) ?? 0,
      n: v.length,
    }),
    (d) => dowMon0(d.date),
    (d) => d.carrier
  );

  const result: DayOfWeekDelayRow[] = [];
  for (const [dow, byCarrier] of grouped) {
    if (!Number.isFinite(dow) || dow < 0 || dow > 6) continue;
    for (const [carrier, stats] of byCarrier) {
      result.push({
        dow,
        dow_name: dowName[dow],
        carrier,
        mean_delay: +stats.mean_delay.toFixed(2),
        n: stats.n,
      });
    }
  }
  return result.sort((a, b) => a.dow - b.dow || a.carrier.localeCompare(b.carrier));
}

export function compounding_stat(rows: FlightRow[]) {
  const tueMorning = rows.filter((r) => dowMon0(r.date) === 1 && r.sched_hour === 6);
  const sunEvening = rows.filter((r) => dowMon0(r.date) === 6 && r.sched_hour === 20);
  return {
    tue_6am_mean: d3.mean(tueMorning, (d) => d.dep_delay_min) ?? 0,
    sun_8pm_mean: d3.mean(sunEvening, (d) => d.dep_delay_min) ?? 0,
    n_tue: tueMorning.length,
    n_sun: sunEvening.length,
  };
}

export function logAggregationSamples(
  hourlyOntime: HourlyOntimeRow[],
  hourlyCause: HourlyCauseShareRow[],
  monthly: MonthlyDelayRow[],
  paddingByCarrierYear: PaddingCarrierYearRow[]
): void {
  console.group("[TPA delays] Aggregation samples");
  console.log("tshourly_ontime_pct first 6:", hourlyOntime.slice(0, 6));
  console.log("hourly_cause_share hours 6,12,20:", hourlyCause.filter((h) => [6, 12, 20].includes(h.hour)));
  console.log("monthly_delay_breakdown:", monthly);
  console.log("padding_by_carrier_year:", paddingByCarrierYear);
  console.groupEnd();
}
