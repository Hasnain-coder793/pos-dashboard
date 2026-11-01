import Button from "@/components/Button";
import { SalesPeriod } from "@/enums";
import type { SalesFilter } from "@/types";
import { karachiToday } from "@/utils/date-range";

const periods = [
  { value: "", label: "All" },
  ...Object.values(SalesPeriod).map((p) => ({ value: p, label: p === SalesPeriod.DAY ? "Today" : p })),
];

// GET form shared by Sales and Analysis: the filter lives in the URL
export default function SalesFilters({ period, date }: SalesFilter) {
  return (
    <form className="flex flex-wrap items-center gap-3">
      {periods.map((p) => (
        <label key={p.label} className="flex cursor-pointer items-center gap-2 text-sm font-semibold capitalize">
          <input type="radio" name="period" value={p.value} defaultChecked={p.value === period} className="size-4 cursor-pointer accent-primary" />
          {p.label}
        </label>
      ))}
      <input
        type="date"
        name="date"
        defaultValue={date}
        max={karachiToday()}
        className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-primary"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
