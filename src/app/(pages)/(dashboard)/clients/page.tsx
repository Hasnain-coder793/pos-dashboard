import Link from "next/link";
import Pagination from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";
import Table from "@/components/Table";
import { Role, SalesPeriod } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchSchema, type Client } from "@/types";
import { getDateRange, karachiToday } from "@/utils/date-range";
import { formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

const CLIENTS_PAGE_SIZE = 25;

const periods = [
  { value: "", label: "All" },
  { value: SalesPeriod.DAY, label: "Today" },
  { value: SalesPeriod.WEEK, label: "This week" },
  { value: SalesPeriod.YEAR, label: "This year" },
];

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requireRole(Role.SUPER_ADMIN);
  const params = await searchParams;
  const q = searchSchema.parse(params.q).replace(/[,()]/g, "");
  const page = pageSchema.parse(params.page);
  const period = periods.find((p) => p.value && p.value === params.period)?.value as SalesPeriod | undefined;

  const supabase = await createClient();
  let query = supabase
    .from("client_summary")
    .select("*", { count: "exact" })
    .order("last_purchase_at", { ascending: false })
    .range(...pageRange(page, CLIENTS_PAGE_SIZE));
  if (q) query = query.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
  // Bought in the period = last purchase on or after the period start (Karachi time)
  if (period) query = query.gte("last_purchase_at", getDateRange(period, karachiToday()).from);
  const { data, count } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <>
      <h1 className="text-2xl font-bold">Clients</h1>
      <SearchForm placeholder="Search by name or phone" defaultValue={q}>
        {periods.map((p) => (
          <label key={p.label} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="radio" name="period" value={p.value} defaultChecked={p.value === (period ?? "")} className="size-4 cursor-pointer accent-primary" />
            {p.label}
          </label>
        ))}
      </SearchForm>

      <Table headers={["Name", "Phone", "Orders", "Total spent", "Last purchase"]} empty={!clients.length}>
        {clients.map((client) => (
          <tr key={client.customer_phone} className="hover:bg-neutral-50">
            <td className="font-semibold">
              <Link href={`/clients/${client.customer_phone}`} className="hover:underline">
                {client.customer_name ?? "Unknown"}
              </Link>
            </td>
            <td>{client.customer_phone}</td>
            <td>{client.order_count}</td>
            <td>{formatPKR(Number(client.total_spent_pkr))}</td>
            <td className="whitespace-nowrap">{formatDateTime(client.last_purchase_at)}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} params={{ q, period: period ?? "" }} pageSize={CLIENTS_PAGE_SIZE} />
    </>
  );
}
