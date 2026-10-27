import { getUserEmails } from "@/actions/users.actions";
import Pagination from "@/components/Pagination";
import { Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import UsersTable from "@/sections/UsersTable";
import type { Profile } from "@/types";
import { pageRange, pageSchema } from "@/utils/pagination";

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  await requireRole(Role.SUPER_ADMIN);
  const page = pageSchema.parse((await searchParams).page);

  const supabase = await createClient();
  const [{ data, count }, emails] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact" }).order("created_at").range(...pageRange(page)),
    getUserEmails(),
  ]);
  const users = ((data ?? []) as Profile[]).map((profile) => ({ ...profile, email: emails[profile.id] ?? "" }));

  return (
    <>
      <h1 className="text-2xl font-bold">User Management</h1>
      <UsersTable users={users} />
      <Pagination page={page} total={count ?? 0} />
    </>
  );
}
