import { randomUUID } from "node:crypto";
import { inject } from "vitest";
import { anonClient, PREFIX, serviceClient, type TestUser, type UserKey } from "./shared";

export * from "./shared";

declare module "vitest" {
  export interface ProvidedContext {
    run: string;
    users: Record<UserKey, TestUser>;
  }
}

// A client signed in as one of the shared test users (reuses the session from setup, no new sign-in)
export async function signedIn(key: UserKey) {
  const user = inject("users")[key];
  const client = anonClient();
  const { error } = await client.auth.setSession({ access_token: user.access_token, refresh_token: user.refresh_token });
  if (error) throw error;
  return { client, user };
}

export const testName = (label: string) => `IT-${inject("run")}-${label}`;
export const testEmail = (label: string) => `${PREFIX}${inject("run")}-${label}@example.com`;

// Returns the data of a Supabase call, or throws its error
export async function must<R extends { data: unknown; error: unknown }>(query: PromiseLike<R>): Promise<NonNullable<R["data"]>> {
  const { data, error } = await query;
  if (error) throw error;
  return data as NonNullable<R["data"]>;
}

export async function createProduct(label: string, extra: Record<string, unknown> = {}) {
  return must(
    serviceClient()
      .from("products")
      .insert({ name: testName(label), price_pkr: 200, ...extra })
      .select("id, name, price_pkr, image_url, is_active, deleted_at")
      .single(),
  );
}

type Line = { product_id: string; product_name: string; unit_price_pkr: number; qty: number };

// A sync_sale payload whose totals add up
export function salePayload(createdBy: string, lines: Line[], extra: Record<string, unknown> = {}) {
  const items = lines.map((line) => ({ ...line, line_total_pkr: line.unit_price_pkr * line.qty }));
  const total = items.reduce((sum, item) => sum + item.line_total_pkr, 0);
  return {
    id: randomUUID(),
    receipt_no: `IT-${randomUUID()}`,
    device_id: "integration-test",
    created_by: createdBy,
    cashier_name: "IT Cashier",
    total_items: items.reduce((sum, item) => sum + item.qty, 0),
    total_pkr: total,
    cash_received_pkr: total + 100,
    change_pkr: 100,
    sold_at: new Date().toISOString(),
    items,
    ...extra,
  };
}

// 1x1 PNG
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

export const imagePath = (label: string, ext = "png") => `products/${PREFIX}${inject("run")}-${label}-${randomUUID()}.${ext}`;
