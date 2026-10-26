import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Role } from "@/enums";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

// The caller's profile, read fresh from the database once per request
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

export const isDashboardUser = (profile: Profile | null): profile is Profile =>
  !!profile && profile.is_active && profile.role !== Role.EDITOR;

// Server actions call this first; returns null when the caller may not use the dashboard
export async function getCaller(): Promise<Profile | null> {
  const profile = await getProfile();
  return isDashboardUser(profile) ? profile : null;
}

// Pages call this first: signed out → /login, wrong role → 404
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isDashboardUser(profile)) redirect("/login");
  if (!roles.includes(profile.role)) notFound();
  return profile;
}
