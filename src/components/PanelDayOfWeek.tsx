import { ScrollSection } from "./ScrollSection";
import { DayOfWeekChart } from "./charts/DayOfWeekChart";
import type { DayOfWeekDelayRow } from "../data/aggregations";

type Props = {
  rows: DayOfWeekDelayRow[];
};

export function PanelDayOfWeek({ rows }: Props) {
  return (
    <ScrollSection>
      {({ revealed }) => <DayOfWeekChart rows={rows} revealed={revealed} />}
    </ScrollSection>
  );
}
