import { createClient } from "@supabase/supabase-js";

// Every test row is tagged with this prefix so cleanup can find it (users by email, products by name, files by path)
export const PREFIX = "it-";
export const PASSWORD = "it-Passw0rd!2026";
export const BUCKET = "product-images";

export const USERS = {
  superAdmin: { role: "super_admin", can_sell: true },
  admin: { role: "admin", can_sell: false },
  seller: { role: "admin", can_sell: true },
  editor: { role: "editor", can_sell: false },
} as const;

export type UserKey = keyof typeof USERS;
export type TestUser = { id: string; email: string; access_token: string; refresh_token: string };

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
export const serviceClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);

export type Client = ReturnType<typeof anonClient>;
