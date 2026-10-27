// Seeds 100 products, 100 clients and 10,000 random sales (with items) over the last 90 days.
// Needs at least one active user to act as cashier.
// Usage: npm run seed-sales
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
const SALES_COUNT = 10000;
const PRODUCTS_COUNT = 100;
const CLIENTS_COUNT = 100;
const DAYS_BACK = 90;
const CHUNK_SIZE = 1000;

if (!url || !serviceKey) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Inserts rows in chunks so large payloads don't hit request limits
const insertInChunks = async (table, rows, select) => {
  const inserted = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const query = supabase.from(table).insert(rows.slice(i, i + CHUNK_SIZE));
    const { data, error } = select ? await query.select(select) : await query;
    if (error) {
      console.error(`Could not insert ${table}: ${error.message}`);
      process.exit(1);
    }
    if (data) inserted.push(...data);
  }
  return inserted;
};

const { data: users } = await supabase.from("profiles").select("id, full_name").eq("is_active", true);
if (!users?.length) {
  console.error("Need at least one active user before seeding");
  process.exit(1);
}

// 100 products: 20 base items x 5 sizes
const baseItems = [
  "Tea", "Coffee", "Juice", "Water", "Milk", "Biscuits", "Chips", "Bread", "Rice", "Sugar",
  "Flour", "Cooking Oil", "Soap", "Shampoo", "Toothpaste", "Detergent", "Eggs", "Butter", "Cheese", "Yogurt",
];
const sizes = ["Small", "Medium", "Large", "Family Pack", "Bulk"];
const products = await insertInChunks(
  "products",
  baseItems
    .flatMap((item) => sizes.map((size) => ({ name: `${item} ${size}`, price_pkr: randomInt(50, 3000) })))
    .slice(0, PRODUCTS_COUNT),
  "id, name, price_pkr",
);

// 100 clients with unique 92XXXXXXXXXX phones
const firstNames = ["Ali", "Ayesha", "Usman", "Fatima", "Bilal", "Sana", "Hamza", "Zainab", "Ahmed", "Hira"];
const lastNames = ["Khan", "Malik", "Tariq", "Noor", "Ahmed", "Iqbal", "Raza", "Shah", "Butt", "Qureshi"];
const clients = Array.from({ length: CLIENTS_COUNT }, (_, i) => ({
  name: `${firstNames[i % 10]} ${lastNames[Math.floor(i / 10) % 10]}`,
  phone: `923${String(randomInt(0, 99999)).padStart(5, "0")}${String(i).padStart(4, "0")}`,
}));

const sales = [];
const items = [];

for (let i = 0; i < SALES_COUNT; i++) {
  const id = randomUUID();
  const user = pick(users);
  // about 70% of sales have a known client
  const client = Math.random() < 0.7 ? pick(clients) : null;
  const soldAt = new Date(Date.now() - Math.random() * DAYS_BACK * 24 * 60 * 60 * 1000);

  const lines = Array.from({ length: randomInt(1, 5) }, () => {
    const product = pick(products);
    const qty = randomInt(1, 4);
    return {
      sale_id: id,
      product_id: product.id,
      product_name: product.name,
      unit_price_pkr: product.price_pkr,
      qty,
      line_total_pkr: product.price_pkr * qty,
    };
  });

  const total = lines.reduce((sum, line) => sum + line.line_total_pkr, 0);
  const cashReceived = Math.ceil(total / 500) * 500;

  sales.push({
    id,
    receipt_no: `SEED-${soldAt.getTime()}-${i}`,
    device_id: "seed-script",
    created_by: user.id,
    cashier_name: user.full_name || "Cashier",
    customer_name: client?.name ?? null,
    customer_phone: client?.phone ?? null,
    total_items: lines.reduce((sum, line) => sum + line.qty, 0),
    total_pkr: total,
    cash_received_pkr: cashReceived,
    change_pkr: cashReceived - total,
    sold_at: soldAt.toISOString(),
  });
  items.push(...lines);
}

await insertInChunks("sales", sales);
await insertInChunks("sale_items", items);

console.log(`Seeded ${products.length} products, ${clients.length} clients, ${sales.length} sales with ${items.length} items`);
