// Deletes every user, Super Admin included. Their profiles go with them (on delete cascade).
// Sales, expenses, requests and logs point at profiles, so run clean-db first (npm script does both).
// Afterwards run create-super-admin to log in again.
// Usage: npm run delete-users
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;

if (!url || !serviceKey) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Always read the first page: deleted users drop out, so the next batch moves up
let removed = 0;
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) {
    console.error(`Could not list users: ${error.message}`);
    process.exit(1);
  }
  if (!data.users.length) break;

  for (const user of data.users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`Could not delete ${user.email}: ${error.message}`);
      process.exit(1);
    }
    console.log(`Deleted ${user.email}`);
    removed++;
  }
}

console.log(`Done: removed ${removed} users`);
