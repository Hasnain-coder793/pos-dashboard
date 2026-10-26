import { getUserEmails } from "@/actions/users.actions";
import { Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import UsersTable from "@/sections/UsersTable";
import type { Profile } from "@/types";

export default async function UsersPage() {
  await requireRole(Role.SUPER_ADMIN);

  const supabase = await createClient();
  const [{ data }, emails] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), getUserEmails()]);
  const users = ((data ?? []) as Profile[]).map((profile) => ({ ...profile, email: emails[profile.id] ?? "" }));

  return (
    <>
      <h1 className="text-2xl font-bold">User Management</h1>
      <UsersTable users={users} />
    </>
  );
}
