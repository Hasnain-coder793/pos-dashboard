import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS, only for auth.admin calls in users.actions.ts
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
