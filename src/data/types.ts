export type CarrierName = "American" | "Delta" | "Southwest";

export interface FlightRow {
  carrier: CarrierName;
  date: string;
  sched_hour: number;
  dep_delay_min: number;
  destination: string;
  sched_elapsed_min: number;
  actual_elapsed_min: number;
  cause_carrier_min: number;
  cause_weather_min: number;
  cause_nas_min: number;
  cause_late_aircraft_min: number;
}
