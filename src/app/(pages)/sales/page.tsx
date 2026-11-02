import AutoRefresh from "@/components/AutoRefresh";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SaleReceipt from "@/sections/SaleReceipt";
import SalesFilters from "@/sections/SalesFilters";
import { salesFilterSchema, type ReportRow, type SaleRow } from "@/types";
import { ALL_TIME, getDateRange } from "@/utils/date-range";
import { formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  await requireRole(Role.SUPER_ADMIN);
  const params = await searchParams;
  const { period, date } = salesFilterSchema.parse({ period: params.period, date: params.date });
  const page = pageSchema.parse(params.page);
  const { from, to } = period ? getDateRange(period, date) : ALL_TIME;

  const supabase = await createClient();
  const [{ data: report }, { data: sales, count }] = await Promise.all([
    supabase.rpc("sales_item_report", { p_from: from, p_to: to }),
    supabase
      .from("sales")
      .select("id, receipt_no, sold_at, cashier_name, customer_name, total_items, total_pkr, sale_items(product_name, unit_price_pkr, qty, line_total_pkr)", { count: "exact" })
      .gte("sold_at", from)
      .lt("sold_at", to)
      .order("sold_at", { ascending: false })
      .range(...pageRange(page)),
  ]);

  const rows = (report ?? []) as ReportRow[];
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty_sold), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount_pkr), 0);
  const summary = [
    { label: "Orders", value: String(count ?? 0) },
    { label: "Items sold", value: String(totalQty) },
    { label: "Total sales", value: formatPKR(totalAmount) },
  ];

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Sales</h1>

      <SalesFilters period={period} date={date} />

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
            <p className="text-sm text-slate-600">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold">
        {!period ? "All sales" : period === SalesPeriod.DAY ? "Sales today" : `Sales in this ${period}`}
      </h2>
      <Table headers={["Receipt", "Time", "Cashier", "Customer", "Items", "Total", "View"]} empty={!sales?.length}>
        {((sales ?? []) as SaleRow[]).map((sale) => (
          <tr key={sale.id}>
            <td className="font-semibold">{sale.receipt_no}</td>
            <td className="whitespace-nowrap">{formatDateTime(sale.sold_at)}</td>
            <td>{sale.cashier_name}</td>
            <td>{sale.customer_name ?? "—"}</td>
            <td>{sale.total_items}</td>
            <td>{formatPKR(sale.total_pkr)}</td>
            <td>
              <SaleReceipt sale={sale} />
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} params={{ period, date }} />
    </>
  );
}
