import type { ReportRow } from "@/types";

// Items by quantity sold as horizontal bars. The SVG width attribute sizes each bar, since Tailwind classes can't come from data.
export default function ItemsChart({ rows }: { rows: ReportRow[] }) {
  const sorted = [...rows].sort((a, b) => Number(b.qty_sold) - Number(a.qty_sold));
  const max = Number(sorted[0]?.qty_sold) || 1;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
      <h2 className="font-bold">Quantity sold</h2>

      {sorted.map((row) => (
        <div key={row.product_name} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate" title={row.product_name}>
            {row.product_name}
          </span>
          <div className="flex h-5 items-center">
            <svg width={`${(Number(row.qty_sold) / max) * 100}%`} height="100%" className="min-w-1 rounded-r bg-primary" aria-hidden />
          </div>
          <span className="text-right font-semibold">{row.qty_sold}</span>
        </div>
      ))}
    </div>
  );
}
