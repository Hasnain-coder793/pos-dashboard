// Deletes every row of business data: sales, orders, items, expenses, requests, notifications and the activity log.
// Users (profiles) and role permissions are kept so you can still log in.
// Usage: npm run clean-db
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;

if (!url || !serviceKey) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Children before parents; activity_log last because delete triggers write to it
const tables = [
  "sale_items",
  "sales",
  "product_deletion_requests",
  "products",
  "expense_requests",
  "expenses",
  "notifications",
  "activity_log",
];

for (const table of tables) {
  const { count, error } = await supabase.from(table).delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    console.error(`Could not clean ${table}: ${error.message}`);
    process.exit(1);
  }
  console.log(`${table}: removed ${count ?? 0} rows`);
}

console.log("Done: database is clean");
