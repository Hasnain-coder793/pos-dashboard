import Checkbox from "@/components/Checkbox";
import SearchForm from "@/components/SearchForm";
import { RequestStatus, Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ItemsTable from "@/sections/ItemsTable";
import ItemsTabs from "@/sections/ItemsTabs";
import { searchSchema } from "@/types";

export default async function ItemsPage({ searchParams }: PageProps<"/items">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const params = await searchParams;
  const q = searchSchema.parse(params.q);
  const showDeleted = profile.role === Role.SUPER_ADMIN && params.deleted === "on";

  const supabase = await createClient();
  let query = supabase.from("products").select("id, name, price_pkr, image_url, is_active, deleted_at, updated_at").order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  if (!showDeleted) query = query.is("deleted_at", null);

  const [{ data: products }, { data: pending }] = await Promise.all([
    query,
    supabase.from("product_deletion_requests").select("product_id").eq("status", RequestStatus.PENDING),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Items</h1>
      <ItemsTabs active="/items" />
      <SearchForm placeholder="Search by name" defaultValue={q}>
        {profile.role === Role.SUPER_ADMIN && <Checkbox label="Show deleted" name="deleted" defaultChecked={showDeleted} />}
      </SearchForm>
      <ItemsTable products={products ?? []} pendingIds={(pending ?? []).map((row) => row.product_id)} role={profile.role} />
    </>
  );
}
