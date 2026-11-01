import AutoRefresh from "@/components/AutoRefresh";
import { Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ItemsChart from "@/sections/ItemsChart";
import SalesFilters from "@/sections/SalesFilters";
import { salesFilterSchema, type ReportRow } from "@/types";
import { ALL_TIME, getDateRange } from "@/utils/date-range";

export default async function AnalysisPage({ searchParams }: PageProps<"/analysis">) {
  await requireRole(Role.SUPER_ADMIN);
  const params = await searchParams;
  const { period, date } = salesFilterSchema.parse({ period: params.period, date: params.date });
  const { from, to } = period ? getDateRange(period, date) : ALL_TIME;

  const supabase = await createClient();
  const { data } = await supabase.rpc("sales_item_report", { p_from: from, p_to: to });
  const rows = (data ?? []) as ReportRow[];

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Sales Analysis</h1>
      <SalesFilters period={period} date={date} />
      {rows.length ? <ItemsChart rows={rows} /> : <p className="text-slate-600">No items sold in this period.</p>}
    </>
  );
}
