import AutoRefresh from "@/components/AutoRefresh";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { decideExpenseRequest } from "@/actions/expenses.actions";
import { ExpenseRequestType, Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExpensesTable from "@/sections/ExpensesTable";
import RequestActions from "@/sections/RequestActions";
import SalesFilters from "@/sections/SalesFilters";
import { salesFilterSchema, type Expense, type ExpenseRequest, type ExpenseSummary } from "@/types";
import { ALL_TIME, getDateRange, toKarachiDate } from "@/utils/date-range";
import { formatDate, formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const canDecide = profile.role === Role.SUPER_ADMIN;
  const params = await searchParams;
  const { period, date } = salesFilterSchema.parse({ period: params.period, date: params.date });
  const page = pageSchema.parse(params.page);
  const range = period ? getDateRange(period, date) : ALL_TIME;
  const [from, to] = [range.from, range.to].map(toKarachiDate);

  const supabase = await createClient();
  const [{ data: summary }, { data: expenses, count }, { data: requests }] = await Promise.all([
    supabase.rpc("expense_summary", { p_from: from, p_to: to }).single<ExpenseSummary>(),
    supabase
      .from("expenses")
      .select("id, title, amount_pkr, note, spent_on, status, created_by_name, created_at", { count: "exact" })
      .is("deleted_at", null)
      .gte("spent_on", from)
      .lt("spent_on", to)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(...pageRange(page))
      .returns<Expense[]>(),
    supabase
      .from("expense_requests")
      .select("id, expense_id, request_type, reason, created_by_name, created_at, expense:expenses(title, amount_pkr, spent_on)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<ExpenseRequest[]>(),
  ]);

  const pending = requests ?? [];
  const cards = [
    { label: "Expenses", value: String(summary?.expense_count ?? 0) },
    { label: "Total expenses", value: formatPKR(Number(summary?.total_pkr ?? 0)) },
    { label: "Pending requests", value: String(pending.length) },
  ];

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Expenses</h1>

      <SalesFilters period={period} date={date} />

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold">
        {!period ? "All expenses" : period === SalesPeriod.DAY ? "Expenses today" : `Expenses in this ${period}`}
      </h2>
      <ExpensesTable expenses={expenses ?? []} pendingIds={pending.map((request) => request.expense_id)} role={profile.role} />
      <Pagination page={page} total={count ?? 0} params={{ period, date }} />

      <h2 className="text-lg font-bold">Cancel and delete requests</h2>
      <Table headers={["Expense", "Type", "Reason", "Requested", canDecide ? "Decision" : "Status"]} empty={!pending.length}>
        {pending.map((request) => (
          <tr key={request.id} className="align-top">
            <td>
              <p className="font-semibold">{request.expense?.title ?? "—"}</p>
              <p className="text-slate-600">
                {request.expense && `${formatDate(request.expense.spent_on)} · ${formatPKR(request.expense.amount_pkr)}`}
              </p>
            </td>
            <td>
              <Badge variant={request.request_type === ExpenseRequestType.DELETE ? "solid" : "outline"}>
                {request.request_type === ExpenseRequestType.DELETE ? "Delete" : "Cancel"}
              </Badge>
            </td>
            <td className="max-w-xs">{request.reason}</td>
            <td className="whitespace-nowrap">
              <p>{request.created_by_name}</p>
              <p className="text-slate-600">{formatDateTime(request.created_at)}</p>
            </td>
            <td>{canDecide ? <RequestActions requestId={request.id} decide={decideExpenseRequest} /> : <Badge>Pending</Badge>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
