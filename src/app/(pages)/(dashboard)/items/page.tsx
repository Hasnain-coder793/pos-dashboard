import AutoRefresh from "@/components/AutoRefresh";
import Checkbox from "@/components/Checkbox";
import Pagination from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";
import { RequestStatus, Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ItemsTable from "@/sections/ItemsTable";
import ItemsTabs from "@/sections/ItemsTabs";
import SalesFilters from "@/sections/SalesFilters";
import { salesFilterSchema, searchSchema } from "@/types";
import { ALL_TIME, getDateRange } from "@/utils/date-range";
import { pageRange, pageSchema } from "@/utils/pagination";

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const params = await searchParams;
  const q = searchSchema.parse(params.q);
  const page = pageSchema.parse(params.page);
  const showDeleted = profile.role === Role.SUPER_ADMIN && params.deleted === "on";
  // Items default to "All" so the full catalog shows on first visit
  const { period, date } = salesFilterSchema.parse({ period: params.period ?? "", date: params.date });
  const { from, to } = period ? getDateRange(period, date) : ALL_TIME;

  const supabase = await createClient();
  let query = supabase.from("products").select("id, name, price_pkr, is_active, deleted_at, updated_at", { count: "exact" })
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .range(...pageRange(page));
  if (q) query = query.ilike("name", `%${q}%`);
  if (!showDeleted) query = query.is("deleted_at", null);

  const countItems = () => supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", from).lt("created_at", to);

  const [{ data: products, count }, { count: total }, { count: active }, { data: pending }] = await Promise.all([
    query,
    countItems(),
    countItems().eq("is_active", true),
    supabase.from("product_deletion_requests").select("product_id").eq("status", RequestStatus.PENDING),
  ]);

  const pendingIds = (pending ?? []).map((row) => row.product_id);
  const cards = [
    { label: "Total items", value: String(total ?? 0) },
    { label: "Active items", value: String(active ?? 0) },
    { label: "Pending requests", value: String(pendingIds.length) },
  ];

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-bold">Items</h1>
      <ItemsTabs active="/items" />

      <SalesFilters period={period} date={date} />
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
            <p className="text-sm text-slate-600">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <SearchForm placeholder="Search by name" defaultValue={q}>
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="date" value={date} />
        {profile.role === Role.SUPER_ADMIN && <Checkbox label="Show deleted" name="deleted" defaultChecked={showDeleted} />}
      </SearchForm>

      <h2 className="text-lg font-bold">
        {!period ? "All items" : period === SalesPeriod.DAY ? "Items added today" : `Items added this ${period}`}
      </h2>
      <ItemsTable products={products ?? []} pendingIds={pendingIds} role={profile.role} />
      <Pagination page={page} total={count ?? 0} params={{ q, deleted: showDeleted ? "on" : "", period, date }} />
    </>
  );
}
