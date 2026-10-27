// Removes everything added by seed-sales: seeded sales, their items, and the seeded products.
// Clients disappear with their sales (the clients list is built from sales).
// Usage: npm run unseed-sales
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
const CHUNK_SIZE = 200;

if (!url || !serviceKey) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// 1. Seeded sales: delete in chunks, items first (sale_items blocks deleting a sale that still has items)
let salesRemoved = 0;
while (true) {
  const { data, error } = await supabase.from("sales").select("id").eq("device_id", "seed-script").limit(CHUNK_SIZE);
  if (error) fail(`Could not read sales: ${error.message}`);
  if (!data.length) break;

  const ids = data.map((sale) => sale.id);
  const { error: itemsError } = await supabase.from("sale_items").delete().in("sale_id", ids);
  if (itemsError) fail(`Could not delete sale items: ${itemsError.message}`);
  const { error: salesError } = await supabase.from("sales").delete().in("id", ids);
  if (salesError) fail(`Could not delete sales: ${salesError.message}`);

  salesRemoved += ids.length;
  console.log(`Removed ${salesRemoved} sales…`);
}

// 2. Seeded products (same names the seed script creates)
const baseItems = [
  "Tea", "Coffee", "Juice", "Water", "Milk", "Biscuits", "Chips", "Bread", "Rice", "Sugar",
  "Flour", "Cooking Oil", "Soap", "Shampoo", "Toothpaste", "Detergent", "Eggs", "Butter", "Cheese", "Yogurt",
];
const sizes = ["Small", "Medium", "Large", "Family Pack", "Bulk"];
const names = baseItems.flatMap((item) => sizes.map((size) => `${item} ${size}`));

const { data: products, error: productsError } = await supabase.from("products").select("id").in("name", names);
if (productsError) fail(`Could not read products: ${productsError.message}`);

// Keep any product that a real sale or a request still points to
let productsRemoved = 0;
for (const { id } of products) {
  const [{ count: sold }, { count: requested }] = await Promise.all([
    supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("product_deletion_requests").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);
  if (sold || requested) continue;

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) fail(`Could not delete product: ${error.message}`);
  productsRemoved++;
}

console.log(`Done: removed ${salesRemoved} sales and ${productsRemoved} products (${products.length - productsRemoved} kept because they are in use)`);
