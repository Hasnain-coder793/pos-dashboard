import Button from "@/components/Button";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { salesFilterSchema, type ReportRow, type SaleRow } from "@/types";
import { getDateRange, karachiToday } from "@/utils/date-range";
import { formatDateTime, formatPKR } from "@/utils/format";
import { PAGE_SIZE, pageRange, pageSchema } from "@/utils/pagination";

const inputClass = "h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-primary";

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  await requireRole(Role.SUPER_ADMIN);
  const params = await searchParams;
  const { period, date } = salesFilterSchema.parse({ period: params.period, date: params.date });
  const page = pageSchema.parse(params.page);
  const reportPage = pageSchema.parse(params.reportPage);
  const { from, to } = getDateRange(period, date);

  const supabase = await createClient();
  const [{ data: report }, { data: sales, count }] = await Promise.all([
    supabase.rpc("sales_item_report", { p_from: from, p_to: to }),
    supabase
      .from("sales")
      .select("id, receipt_no, sold_at, cashier_name, customer_name, total_items, total_pkr", { count: "exact" })
      .gte("sold_at", from)
      .lt("sold_at", to)
      .order("sold_at", { ascending: false })
      .range(...pageRange(page)),
  ]);

  const rows = (report ?? []) as ReportRow[];
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty_sold), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount_pkr), 0);
  const reportRows = rows.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE);
  const summary = [
    { label: "Orders", value: String(count ?? 0) },
    { label: "Items sold", value: String(totalQty) },
    { label: "Total sales", value: formatPKR(totalAmount) },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Sales</h1>

      <form className="flex flex-wrap items-center gap-3">
        <select name="period" defaultValue={period} className={`${inputClass} cursor-pointer capitalize`}>
          {Object.values(SalesPeriod).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input type="date" name="date" defaultValue={date} max={karachiToday()} className={inputClass} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
            <p className="text-sm text-slate-600">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <Table headers={["Item", "Quantity sold", "Sales amount"]} empty={!rows.length}>
        {reportRows.map((row) => (
          <tr key={row.product_name}>
            <td className="font-semibold">{row.product_name}</td>
            <td>{row.qty_sold}</td>
            <td>{formatPKR(Number(row.amount_pkr))}</td>
          </tr>
        ))}
        <tr className="bg-blue-50 font-bold">
          <td>Total</td>
          <td>{totalQty}</td>
          <td>{formatPKR(totalAmount)}</td>
        </tr>
      </Table>
      <Pagination page={reportPage} total={rows.length} pageKey="reportPage" params={{ period, date, page: String(page) }} />

      <h2 className="text-lg font-bold">Sales in this {period}</h2>
      <Table headers={["Receipt", "Time", "Cashier", "Customer", "Items", "Total"]} empty={!sales?.length}>
        {((sales ?? []) as SaleRow[]).map((sale) => (
          <tr key={sale.id}>
            <td className="font-semibold">{sale.receipt_no}</td>
            <td className="whitespace-nowrap">{formatDateTime(sale.sold_at)}</td>
            <td>{sale.cashier_name}</td>
            <td>{sale.customer_name ?? "—"}</td>
            <td>{sale.total_items}</td>
            <td>{formatPKR(sale.total_pkr)}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} params={{ period, date, reportPage: String(reportPage) }} />
    </>
  );
}
