import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, BUCKET, createProduct, imagePath, must, PNG, salePayload, serviceClient, signedIn, testEmail, type Client, type TestUser } from "./helpers";

// Database rules (RLS, functions, triggers, storage) checked as each real role

let superAdmin: { client: Client; user: TestUser };
let admin: { client: Client; user: TestUser };
let seller: { client: Client; user: TestUser };
let editor: { client: Client; user: TestUser };
const service = serviceClient();

beforeAll(async () => {
  [superAdmin, admin, seller, editor] = await Promise.all([signedIn("superAdmin"), signedIn("admin"), signedIn("seller"), signedIn("editor")]);
});

const line = (product: { id: string; name: string; price_pkr: number }, qty = 1) => ({
  product_id: product.id,
  product_name: product.name,
  unit_price_pkr: product.price_pkr,
  qty,
});

describe("configuration", () => {
  it("the browser key is the publishable key, never the secret one", () => {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    expect(key.startsWith("sb_secret_")).toBe(false);
    expect(key).not.toBe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  });
});

describe("products", () => {
  it("are hidden from signed-out visitors", async () => {
    const product = await createProduct("anon");
    expect(await must(anonClient().from("products").select("id").eq("id", product.id))).toEqual([]);
  });

  it("POS users see active products only", async () => {
    const [active, hidden] = await Promise.all([createProduct("active"), createProduct("hidden", { is_active: false })]);
    const rows = await must(editor.client.from("products").select("id").in("id", [active.id, hidden.id]));
    expect(rows).toEqual([{ id: active.id }]);
  });

  it("Admin can add a product, Editor cannot", async () => {
    const { error } = await admin.client.from("products").insert({ name: "IT-admin-insert", price_pkr: 100 });
    expect(error).toBeNull();
    const { error: editorError } = await editor.client.from("products").insert({ name: "IT-editor-insert", price_pkr: 100 });
    expect(editorError?.code).toBe("42501");
  });

  it("Admin cannot update a product directly", async () => {
    const product = await createProduct("admin-update");
    const updated = await must(admin.client.from("products").update({ price_pkr: 999 }).eq("id", product.id).select());
    expect(updated).toEqual([]);
    expect(await must(service.from("products").select("price_pkr").eq("id", product.id).single())).toEqual({ price_pkr: 200 });
  });

  it("Super Admin updates are applied and audited by the trigger", async () => {
    const product = await createProduct("sa-update");
    await must(superAdmin.client.from("products").update({ price_pkr: 450 }).eq("id", product.id).select());
    expect(await must(service.from("products").select("price_pkr").eq("id", product.id).single())).toEqual({ price_pkr: 450 });
    const log = await must(service.from("activity_log").select("action, user_id").eq("entity_id", product.id).eq("action", "product_updated"));
    expect(log).toEqual([{ action: "product_updated", user_id: superAdmin.user.id }]);
  });
});

describe("change requests", () => {
  const request = (productId: string, extra: Record<string, unknown> = {}) => ({
    product_id: productId,
    requested_by: admin.user.id,
    request_type: "update",
    reason: "integration test",
    new_price_pkr: 300,
    ...extra,
  });

  it("snapshot the old values and allow only one pending request per item", async () => {
    const product = await createProduct("snapshot");
    const created = await must(admin.client.from("product_deletion_requests").insert(request(product.id)).select("id, old_values").single());
    expect(created.old_values).toEqual({ name: product.name, price_pkr: 200, image_url: null });

    const { error } = await admin.client.from("product_deletion_requests").insert(request(product.id, { new_price_pkr: 400 }));
    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("one_pending_request_per_product");
  });

  it("cannot be created already decided, or changed by Admin", async () => {
    const product = await createProduct("forged");
    const { error } = await admin.client.from("product_deletion_requests").insert(request(product.id, { status: "approved" }));
    expect(error?.code).toBe("42501");

    const created = await must(admin.client.from("product_deletion_requests").insert(request(product.id)).select("id").single());
    const { error: updateError } = await admin.client.from("product_deletion_requests").update({ status: "approved" }).eq("id", created.id);
    expect(updateError?.code).toBe("42501");
  });

  it("only Super Admin can decide; approving an update changes the product once", async () => {
    const product = await createProduct("approve-update");
    const created = await must(admin.client.from("product_deletion_requests").insert(request(product.id, { new_name: `${product.name}-new` })).select("id").single());

    const { error } = await admin.client.rpc("decide_product_request", { p_request_id: created.id, p_approve: true });
    expect(error?.message).toBe("Only Super Admin can decide requests");

    await must(superAdmin.client.rpc("decide_product_request", { p_request_id: created.id, p_approve: true, p_note: "ok" }));
    expect(await must(service.from("products").select("name, price_pkr").eq("id", product.id).single())).toEqual({ name: `${product.name}-new`, price_pkr: 300 });

    const again = await superAdmin.client.rpc("decide_product_request", { p_request_id: created.id, p_approve: false });
    expect(again.error?.message).toBe("Request not found or already decided");
  });

  it("approving a delete soft-deletes; rejecting leaves the product alone", async () => {
    const [toDelete, toKeep] = await Promise.all([createProduct("approve-delete"), createProduct("reject-delete")]);
    const [del, keep] = await Promise.all(
      [toDelete, toKeep].map((product) =>
        must(admin.client.from("product_deletion_requests").insert(request(product.id, { request_type: "delete", new_price_pkr: null })).select("id").single()),
      ),
    );
    await must(superAdmin.client.rpc("decide_product_request", { p_request_id: del.id, p_approve: true }));
    await must(superAdmin.client.rpc("decide_product_request", { p_request_id: keep.id, p_approve: false, p_note: "keep it" }));

    const rows = await must(service.from("products").select("id, is_active, deleted_at").in("id", [toDelete.id, toKeep.id]));
    expect(rows.find((row) => row.id === toDelete.id)).toMatchObject({ is_active: false, deleted_at: expect.any(String) });
    expect(rows.find((row) => row.id === toKeep.id)).toMatchObject({ is_active: true, deleted_at: null });
    expect(await must(service.from("product_deletion_requests").select("status, decision_note").eq("id", keep.id).single())).toEqual({
      status: "rejected",
      decision_note: "keep it",
    });
  });

  it("Admin can see who requested and who decided (requests page join)", async () => {
    const product = await createProduct("names");
    const created = await must(admin.client.from("product_deletion_requests").insert(request(product.id)).select("id").single());
    await must(superAdmin.client.rpc("decide_product_request", { p_request_id: created.id, p_approve: false }));

    const row = await must(
      admin.client
        .from("product_deletion_requests")
        .select(
          `requester:profiles!product_deletion_requests_requested_by_fkey(full_name),
           decider:profiles!product_deletion_requests_decided_by_fkey(full_name)`,
        )
        .eq("id", created.id)
        .single(),
    );
    expect(row).toEqual({ requester: { full_name: "IT admin" }, decider: { full_name: "IT superAdmin" } });
  });
});

describe("reports", () => {
  const range = { p_from: "2000-01-01T00:00:00Z", p_to: "2100-01-01T00:00:00Z" };

  it("are empty for Admin", async () => {
    expect(await must(admin.client.from("sales").select("id").limit(1))).toEqual([]);
    expect(await must(admin.client.from("client_summary").select("customer_phone").limit(1))).toEqual([]);
    expect(await must(admin.client.rpc("sales_item_report", range))).toEqual([]);
  });

  it("return data for Super Admin", async () => {
    const report = await must(superAdmin.client.rpc("sales_item_report", range));
    expect(report.length).toBeGreaterThan(0);
    expect(report[0]).toEqual({ product_name: expect.any(String), qty_sold: expect.any(Number), amount_pkr: expect.any(Number), order_count: expect.any(Number) });
    expect((await must(superAdmin.client.from("client_summary").select("*").limit(1))).length).toBe(1);
  });
});

describe("sales", () => {
  it("sync_sale saves once, records the signed-in cashier and logs it", async () => {
    const product = await createProduct("sale");
    const payload = salePayload(superAdmin.user.id, [line(product, 2)], { customer_phone: "923001234567", customer_name: "IT Client" });

    expect(await must(editor.client.rpc("sync_sale", { payload }))).toBe(true);
    expect(await must(editor.client.rpc("sync_sale", { payload }))).toBe(false);

    const sale = await must(service.from("sales").select("created_by, total_pkr, total_items, sale_items(qty)").eq("id", payload.id).single());
    expect(sale).toEqual({ created_by: editor.user.id, total_pkr: 400, total_items: 2, sale_items: [{ qty: 2 }] });
    const log = await must(service.from("activity_log").select("user_id").eq("entity_id", payload.id).eq("action", "sale_created"));
    expect(log).toEqual([{ user_id: editor.user.id }]);
  });

  it("sync_sale rejects totals that do not match the items and saves nothing", async () => {
    const product = await createProduct("bad-total");
    const payload = salePayload(editor.user.id, [line(product)], { total_pkr: 1, cash_received_pkr: 101 });
    const { error } = await editor.client.rpc("sync_sale", { payload });
    expect(error?.message).toBe("Sale totals do not match its items");
    expect(await must(service.from("sales").select("id").eq("id", payload.id))).toEqual([]);
  });

  it("only users allowed to sell can sync", async () => {
    const product = await createProduct("who-sells");
    const { error } = await admin.client.rpc("sync_sale", { payload: salePayload(admin.user.id, [line(product)]) });
    expect(error?.message).toBe("User is not allowed to sell");
    expect(await must(seller.client.rpc("sync_sale", { payload: salePayload(seller.user.id, [line(product)]) }))).toBe(true);
  });

  it("rejects a badly formatted customer phone", async () => {
    const product = await createProduct("bad-phone");
    const { error } = await editor.client.rpc("sync_sale", { payload: salePayload(editor.user.id, [line(product)], { customer_phone: "03001234567" }) });
    expect(error?.code).toBe("23514");
  });

  it("cannot be inserted or extended directly", async () => {
    const product = await createProduct("direct");
    const payload = salePayload(editor.user.id, [line(product)]);
    const { items, ...sale } = payload;
    const { error } = await editor.client.from("sales").insert(sale);
    expect(error?.code).toBe("42501");

    await must(seller.client.rpc("sync_sale", { payload: salePayload(seller.user.id, [line(product)]) }));
    const { data: existing } = await service.from("sales").select("id").eq("created_by", seller.user.id).limit(1).single();
    const { error: itemError } = await editor.client.from("sale_items").insert({ ...items[0], sale_id: existing!.id });
    expect(itemError?.code).toBe("42501");
  });

  it("cashiers see only their own sales", async () => {
    const product = await createProduct("own-sales");
    const payload = salePayload(seller.user.id, [line(product)]);
    await must(seller.client.rpc("sync_sale", { payload }));
    expect(await must(editor.client.from("sales").select("id").eq("id", payload.id))).toEqual([]);
    expect(await must(seller.client.from("sales").select("id").eq("id", payload.id))).toEqual([{ id: payload.id }]);
  });
});

describe("activity log", () => {
  it("users can log their own events but not system ones or someone else's", async () => {
    const { error: custom } = await editor.client.from("activity_log").insert({ user_id: editor.user.id, action: "it_custom_event" });
    expect(custom).toBeNull();
    const { error: reserved } = await editor.client.from("activity_log").insert({ user_id: editor.user.id, action: "request_approved" });
    expect(reserved?.code).toBe("42501");
    const { error: other } = await editor.client.from("activity_log").insert({ user_id: admin.user.id, action: "it_custom_event" });
    expect(other?.code).toBe("42501");
  });
});

describe("profiles", () => {
  it("accounts created outside the dashboard start inactive", async () => {
    const { data, error } = await service.auth.admin.createUser({ email: testEmail("signup"), password: "it-Passw0rd!2026", email_confirm: true });
    expect(error).toBeNull();
    expect(await must(service.from("profiles").select("role, is_active").eq("id", data.user!.id).single())).toEqual({ role: "editor", is_active: false });
  });

  it("Admin cannot change profiles or read unrelated ones; users read their own", async () => {
    expect(await must(admin.client.from("profiles").update({ role: "super_admin" }).eq("id", admin.user.id).select())).toEqual([]);
    expect(await must(admin.client.from("profiles").select("id").eq("id", editor.user.id))).toEqual([]);
    expect(await must(editor.client.from("profiles").select("role").eq("id", editor.user.id).single())).toEqual({ role: "editor" });
  });
});

describe("product images storage", () => {
  const upload = (client: Client, path: string, body: Buffer, contentType = "image/png") =>
    client.storage.from(BUCKET).upload(path, new Blob([new Uint8Array(body)], { type: contentType }), { contentType, upsert: false });

  it("Admin can upload a PNG, but not a GIF, a file over 2 MB, or overwrite", async () => {
    const path = imagePath("ok");
    expect((await upload(admin.client, path, PNG)).error).toBeNull();
    expect((await upload(admin.client, imagePath("gif", "gif"), PNG, "image/gif")).error).not.toBeNull();
    expect((await upload(admin.client, imagePath("big"), Buffer.alloc(2 * 1024 * 1024 + 1))).error).not.toBeNull();
    expect((await upload(admin.client, path, PNG)).error).not.toBeNull();
  });

  it("Editor cannot upload", async () => {
    expect((await upload(editor.client, imagePath("editor"), PNG)).error).not.toBeNull();
  });

  it("only Super Admin can delete an image", async () => {
    const path = imagePath("delete");
    await upload(admin.client, path, PNG);
    const name = path.split("/")[1];
    const exists = async () => (await must(service.storage.from(BUCKET).list("products", { search: name }))).length === 1;

    await admin.client.storage.from(BUCKET).remove([path]);
    expect(await exists()).toBe(true);
    await superAdmin.client.storage.from(BUCKET).remove([path]);
    expect(await exists()).toBe(false);
  });
});
