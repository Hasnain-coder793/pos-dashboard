import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SaleRow } from "@/types";
import { formatDateTime, formatPKR } from "@/utils/format";

export default async function ClientHistoryPage({ params }: PageProps<"/clients/[phone]">) {
  await requireRole(Role.SUPER_ADMIN);
  const { phone } = await params;
  if (!/^92[0-9]{10}$/.test(phone)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("id, receipt_no, sold_at, cashier_name, customer_name, total_items, total_pkr, sale_items(product_name, qty, line_total_pkr)")
    .eq("customer_phone", phone)
    .order("sold_at", { ascending: false });
  const sales = (data ?? []) as SaleRow[];
  const name = sales.find((sale) => sale.customer_name)?.customer_name ?? "Unknown";

  return (
    <>
      <Link href="/clients" className="self-start text-sm font-semibold hover:underline">
        ← Back to clients
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-slate-600">
          {phone} · {sales.length} orders · {formatPKR(sales.reduce((sum, sale) => sum + sale.total_pkr, 0))}
        </p>
      </div>

      {!sales.length && <p className="text-slate-600">No purchases found.</p>}

      {sales.map((sale) => (
        <div key={sale.id} className="rounded-lg border border-slate-200 bg-secondary p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">Receipt {sale.receipt_no}</span>
            <span className="text-slate-600">{formatDateTime(sale.sold_at)}</span>
          </div>
          {sale.sale_items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.qty} × {item.product_name}
              </span>
              <span>{formatPKR(item.line_total_pkr)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold">
            <span>Total</span>
            <span>{formatPKR(sale.total_pkr)}</span>
          </div>
        </div>
      ))}
    </>
  );
}
