"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/enums";
import { getCaller } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserSchema, updateUserSchema, type ActionResult, type CreateUserValues, type UpdateUserValues } from "@/types";
import { toErrorMessage } from "@/utils/errors";

const denied = { ok: false, error: "You do not have permission to do this" } as const;

const isSuperAdmin = async () => (await getCaller())?.role === Role.SUPER_ADMIN;

// Emails live in auth.users, which only the service-role client can read
export async function getUserEmails(): Promise<Record<string, string>> {
  if (!(await isSuperAdmin())) return {};
  const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  return Object.fromEntries((data?.users ?? []).map((user) => [user.id, user.email ?? ""]));
}

export async function createUser(values: CreateUserValues): Promise<ActionResult> {
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await isSuperAdmin())) return denied;

  const { email, password, full_name, role, can_sell } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error) return { ok: false, error: error.message };

  // handle_new_user already created the profile; set the role on it
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, can_sell: role === Role.ADMIN && can_sell })
    .eq("id", data.user.id);
  if (profileError) return { ok: false, error: toErrorMessage(profileError) };

  revalidatePath("/users");
  return { ok: true };
}

// Removes the auth user (the profile row cascades). Users with sales or history are protected by foreign keys.
export async function deleteUser(id: string): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return denied;

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (!target || target.role === Role.SUPER_ADMIN) return { ok: false, error: "Super Admin accounts cannot be deleted" };

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { ok: false, error: "This user has sales or other history, so they cannot be deleted. Deactivate them instead." };

  revalidatePath("/users");
  return { ok: true };
}

// Saved through the user's session, so RLS manage_users applies. Deactivating also bans the auth user.
export async function updateUser(id: string, values: UpdateUserValues): Promise<ActionResult> {
  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await isSuperAdmin())) return denied;

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (!target || target.role === Role.SUPER_ADMIN) return { ok: false, error: "Super Admin accounts cannot be changed here" };

  const { full_name, role, can_sell, is_active } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, role, can_sell: role === Role.ADMIN && can_sell, is_active })
    .eq("id", id);
  if (error) return { ok: false, error: toErrorMessage(error) };

  const { error: banError } = await createAdminClient().auth.admin.updateUserById(id, { ban_duration: is_active ? "none" : "876000h" });
  if (banError) return { ok: false, error: banError.message };

  revalidatePath("/users");
  return { ok: true };
}
