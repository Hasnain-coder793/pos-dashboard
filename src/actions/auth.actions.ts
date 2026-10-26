"use server";

import { redirect } from "next/navigation";
import { isDashboardUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type ActionResult, type LoginValues } from "@/types";

export async function login(values: LoginValues): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Enter a valid email and password" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Wrong email or password" };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!isDashboardUser(profile)) {
    await supabase.auth.signOut();
    return { ok: false, error: profile?.is_active === false ? "This account is deactivated" : "This account uses the POS app only." };
  }

  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
