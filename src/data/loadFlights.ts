import Papa from "papaparse";
import type { CarrierName, FlightRow } from "./types";

const CSV_META_LINES = 7;

const FILES: { path: string; carrier: CarrierName }[] = [
  { path: "/data/Detailed_Statistics_Departures_AA.csv", carrier: "American" },
  { path: "/data/Detailed_Statistics_Departures_DL.csv", carrier: "Delta" },
  { path: "/data/Detailed_Statistics_Departures_WN.csv", carrier: "Southwest" },
];

function stripHeaderRow(text: string): string {
  const lines = text.split(/\r?\n/);
  return lines.slice(CSV_META_LINES).join("\n");
}

function parseNum(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDateMmDdYyyy(s: string | undefined): boolean {
  if (!s || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim())) return false;
  const [mm, dd, yyyy] = s.split("/").map((x) => Number(x));
  if (!mm || !dd || !yyyy) return false;
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

function causeOrZero(v: number | null): number {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

function rowFromRecord(
  rec: Record<string, string>,
  carrier: CarrierName
): FlightRow | null {
  const keys = Object.keys(rec).reduce<Record<string, string>>((acc, k) => {
    acc[k.trim()] = rec[k] ?? "";
    return acc;
  }, {});

  const date = keys["Date (MM/DD/YYYY)"]?.trim();
  if (!date || !parseDateMmDdYyyy(date)) return null;

  const schedTime = keys["Scheduled departure time"]?.trim();
  if (!schedTime || schedTime.length < 2) return null;
  const schedHour = Number.parseInt(schedTime.slice(0, 2), 10);
  if (!Number.isFinite(schedHour) || schedHour < 0 || schedHour > 23) return null;

  const depDelay = parseNum(keys["Departure delay (Minutes)"]);
  const schedElapsed = parseNum(keys["Scheduled elapsed time (Minutes)"]);
  const actualElapsed = parseNum(keys["Actual elapsed time (Minutes)"]);
  if (depDelay == null || schedElapsed == null || actualElapsed == null) return null;

  const destination = (keys["Destination Airport"] ?? "").trim();
  if (!destination) return null;

  return {
    carrier,
    date,
    sched_hour: schedHour,
    dep_delay_min: depDelay,
    destination,
    sched_elapsed_min: schedElapsed,
    actual_elapsed_min: actualElapsed,
    cause_carrier_min: causeOrZero(parseNum(keys["Delay Carrier (Minutes)"])),
    cause_weather_min: causeOrZero(parseNum(keys["Delay Weather (Minutes)"])),
    cause_nas_min: causeOrZero(parseNum(keys["Delay National Aviation System (Minutes)"])),
    cause_late_aircraft_min: causeOrZero(
      parseNum(keys["Delay Late Aircraft Arrival (Minutes)"])
    ),
  };
}

function parseCsvText(text: string, carrier: CarrierName): Promise<FlightRow[]> {
  const body = stripHeaderRow(text);
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(body, {
      header: true,
      dynamicTyping: false,
      worker: true,
      skipEmptyLines: true,
      complete: (res) => {
        const out: FlightRow[] = [];
        for (const rec of res.data) {
          const row = rowFromRecord(rec, carrier);
          if (row) out.push(row);
        }
        resolve(out);
      },
      error: (err) => reject(err),
    });
  });
}

/** BTS-style departure on-time: delay ≤ 0 (left on or before scheduled push). */
export function isOntimeDeparture(depDelayMin: number): boolean {
  return depDelayMin <= 0;
}

function monthFromDate(dateStr: string): number {
  return Number.parseInt(dateStr.split("/")[0]!, 10);
}

function yearFromDate(dateStr: string): number {
  return Number.parseInt(dateStr.split("/")[2]!, 10);
}

export function printSanityChecks(rows: FlightRow[]): void {
  const n = rows.length;
  const meanDelay = d3mean(rows.map((r) => r.dep_delay_min));

  const hourRows = (h: number) => rows.filter((r) => r.sched_hour === h);
  const ontimePct = (h: number) => {
    const rs = hourRows(h);
    if (!rs.length) return 0;
    return (100 * rs.filter((r) => isOntimeDeparture(r.dep_delay_min)).length) / rs.length;
  };

  const lateCauseShare = (h: number) => {
    const rs = hourRows(h).filter((r) => r.dep_delay_min > 0);
    if (!rs.length) return 0;
    const causeTot = rs.reduce(
      (s, r) =>
        s +
        r.cause_weather_min +
        r.cause_nas_min +
        r.cause_carrier_min +
        r.cause_late_aircraft_min,
      0
    );
    if (causeTot <= 0) return 0;
    const late = rs.reduce((s, r) => s + r.cause_late_aircraft_min, 0);
    return (100 * late) / causeTot;
  };

  const meanByMonth = (m: number) => {
    const rs = rows.filter((r) => monthFromDate(r.date) === m);
    return rs.length ? d3mean(rs.map((r) => r.dep_delay_min)) : NaN;
  };

  const padMean = (year: number, carrier: "American" | "Delta" | "Southwest") => {
    const rs = rows.filter((r) => yearFromDate(r.date) === year && r.carrier === carrier);
    if (!rs.length) return NaN;
    return d3mean(rs.map((r) => r.sched_elapsed_min - r.actual_elapsed_min));
  };

  const paddingTable = [2020, 2021, 2022, 2023, 2024, 2025].map((y) => ({
    year: y,
    American: round1(padMean(y, "American")),
    Delta: round1(padMean(y, "Delta")),
    Southwest: round1(padMean(y, "Southwest")),
  }));

  const report = {
    "Total cleaned rows": Math.round(n),
    "Overall mean dep_delay_min (min)": round1(meanDelay ?? NaN),
    "6 AM on-time % (dep_delay ≤ 0)": round1(ontimePct(6)),
    "8 PM on-time % (hour 20)": round1(ontimePct(20)),
    "6 AM late-aircraft share of cause minutes %": round1(lateCauseShare(6)),
    "8 PM late-aircraft share of cause minutes %": round1(lateCauseShare(20)),
    "July mean delay (min)": round1(meanByMonth(7)),
    "October mean delay (min)": round1(meanByMonth(10)),
  };

  console.group("[TPA delays] Sanity checks (match spec within ±1)");
  console.table(report);
  console.log("Schedule padding by carrier & year (mean sched − actual, minutes) — verify vs Story III table:");
  console.table(paddingTable);
  console.log(
    "Definitions: on-time = departure delay ≤ 0 min; late-aircraft share = sum(late cause) / sum(all cause minutes) among rows with dep_delay > 0. Padding = mean(sched_elapsed_min − actual_elapsed_min) by year and carrier, all routes."
  );
  console.groupEnd();
}

function d3mean(values: number[]): number | undefined {
  const n = values.length;
  if (!n) return undefined;
  let s = 0;
  for (const v of values) s += v;
  return s / n;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export async function loadAllFlights(): Promise<FlightRow[]> {
  const chunks = await Promise.all(
    FILES.map(async ({ path, carrier }) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
      const text = await res.text();
      return parseCsvText(text, carrier);
    })
  );
  const rows = chunks.flat();
  printSanityChecks(rows);
  return rows;
}
