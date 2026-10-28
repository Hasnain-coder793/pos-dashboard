import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { ActivityEntity, RequestType, Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { activityFilterSchema, type ActivityRow, type Product } from "@/types";
import { formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

const types = [
  { value: "", label: "All activity" },
  { value: ActivityEntity.PRODUCT, label: "Items" },
  { value: ActivityEntity.REQUEST, label: "Change requests" },
  { value: ActivityEntity.SALE, label: "Sales" },
];

const actionLabels: Record<string, string> = {
  product_created: "Item added",
  product_updated: "Item updated",
  product_deleted: "Item deleted",
  request_created: "Request sent",
  request_approved: "Request approved",
  request_rejected: "Request rejected",
  sale_created: "Sale synced",
};

// Product fields shown as "old → new" when an item is updated
const fields: { key: keyof Product; label: string; format: (value: unknown) => string }[] = [
  { key: "name", label: "Name", format: String },
  { key: "price_pkr", label: "Price", format: (value) => formatPKR(Number(value)) },
  { key: "is_active", label: "Active", format: (value) => (value ? "Yes" : "No") },
];

function describe(row: ActivityRow, productNames: Record<string, string>, receipts: Record<string, string>) {
  const { details } = row;
  if (row.entity_type === ActivityEntity.SALE) return [`Receipt ${receipts[row.entity_id ?? ""] ?? "—"}`];
  if (row.entity_type === ActivityEntity.REQUEST) {
    const type = details?.request_type === RequestType.DELETE ? "Delete" : "Update";
    return [`${productNames[details?.product_id ?? ""] ?? "Unknown item"} · ${type} request`];
  }
  if (row.entity_type !== ActivityEntity.PRODUCT || !details?.new) return ["—"];

  const { old: before, new: after } = details;
  if (row.action !== "product_updated" || !before) return [`${after.name} · ${formatPKR(after.price_pkr ?? 0)}`];
  return [
    `${after.name}`,
    ...fields.filter((field) => before[field.key] !== after[field.key]).map((field) => `${field.label}: ${field.format(before[field.key])} → ${field.format(after[field.key])}`),
    ...(before.image_url !== after.image_url ? ["New image"] : []),
  ];
}

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  await requireRole(Role.SUPER_ADMIN);
  const params = await searchParams;
  const type = activityFilterSchema.parse(params.type);
  const page = pageSchema.parse(params.page);

  const supabase = await createClient();
  let query = supabase
    .from("activity_log")
    .select("id, action, entity_type, entity_id, details, created_at, user:profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(...pageRange(page));
  if (type) query = query.eq("entity_type", type);
  const { data, count } = await query.returns<ActivityRow[]>();
  const rows = data ?? [];

  // Requests and sales only store ids, so look up the item names and receipt numbers for this page
  const productIds = rows.flatMap((row) => (row.details?.product_id ? [row.details.product_id] : []));
  const saleIds = rows.flatMap((row) => (row.entity_type === ActivityEntity.SALE && row.entity_id ? [row.entity_id] : []));
  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, name").in("id", productIds),
    supabase.from("sales").select("id, receipt_no").in("id", saleIds),
  ]);
  const productNames = Object.fromEntries((products ?? []).map((product) => [product.id, product.name]));
  const receipts = Object.fromEntries((sales ?? []).map((sale) => [sale.id, sale.receipt_no]));

  return (
    <>
      <h1 className="text-2xl font-bold">Activity</h1>

      <form className="flex flex-wrap items-center gap-3">
        <select
          name="type"
          defaultValue={type ?? ""}
          className="h-10 cursor-pointer rounded-md border border-slate-300 bg-secondary px-3 text-sm outline-none focus:border-primary"
        >
          {types.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <Table headers={["Time", "User", "Action", "Details"]} empty={!rows.length}>
        {rows.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="whitespace-nowrap">{formatDateTime(row.created_at)}</td>
            <td className="whitespace-nowrap">{row.user?.full_name ?? "—"}</td>
            <td>
              <Badge>{actionLabels[row.action] ?? row.action}</Badge>
            </td>
            <td>
              {describe(row, productNames, receipts).map((line, i) => (
                <p key={i} className={i ? "text-slate-600" : "font-semibold"}>
                  {line}
                </p>
              ))}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} params={{ type: type ?? "" }} />
    </>
  );
}
