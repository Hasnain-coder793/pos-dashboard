import AutoRefresh from "@/components/AutoRefresh";
import Pagination from "@/components/Pagination";
import { RequestStatus, Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExpensesTable from "@/sections/ExpensesTable";
import ExpensesTabs from "@/sections/ExpensesTabs";
import SalesFilters from "@/sections/SalesFilters";
import { salesFilterSchema, type Expense, type ExpenseSummary } from "@/types";
import { ALL_TIME, getDateRange, toKarachiDate } from "@/utils/date-range";
import { formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

// Super Admin sees every expense with filters and totals; Admin sees only today's additions (also enforced by RLS)
export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const isSuperAdmin = profile.role === Role.SUPER_ADMIN;
  const params = await searchParams;
  const { period, date } = salesFilterSchema.parse({ period: params.period, date: params.date });
  const page = pageSchema.parse(params.page);
  const range = period ? getDateRange(period, date) : ALL_TIME;
  const [from, to] = [range.from, range.to].map(toKarachiDate);

  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("id, title, amount_pkr, spent_on, created_by_name, created_at", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(...pageRange(page));
  if (isSuperAdmin) query = query.gte("spent_on", from).lt("spent_on", to);

  const [{ data: expenses, count }, { data: summary }, { data: pending }] = await Promise.all([
    query.returns<Expense[]>(),
    isSuperAdmin ? supabase.rpc("expense_summary", { p_from: from, p_to: to }).single<ExpenseSummary>() : { data: null },
    supabase.from("expense_requests").select("expense_id").eq("status", RequestStatus.PENDING),
  ]);

  const pendingIds = (pending ?? []).map((request) => request.expense_id);
  const cards = [
    { label: "Expenses", value: String(summary?.expense_count ?? 0) },
    { label: "Total expenses", value: formatPKR(Number(summary?.total_pkr ?? 0)) },
    { label: "Pending requests", value: String(pendingIds.length) },
  ];

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Expenses</h1>
      <ExpensesTabs active="/expenses" />

      {isSuperAdmin && (
        <>
          <SalesFilters period={period} date={date} />
          <div className="grid gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
                <p className="text-sm text-slate-600">{card.label}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-lg font-bold">
        {!isSuperAdmin
          ? "Expenses added today"
          : !period
            ? "All expenses"
            : period === SalesPeriod.DAY
              ? "Expenses today"
              : `Expenses in this ${period}`}
      </h2>
      <ExpensesTable expenses={expenses ?? []} pendingIds={pendingIds} role={profile.role} />
      <Pagination page={page} total={count ?? 0} params={isSuperAdmin ? { period, date } : {}} />
    </>
  );
}
