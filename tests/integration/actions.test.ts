import { beforeAll, describe, expect, it, vi } from "vitest";
import { login } from "@/actions/auth.actions";
import { createItem, deleteItem, updateItem } from "@/actions/items.actions";
import { decideRequest } from "@/actions/requests.actions";
import { createUser, deleteUser, getUserEmails, updateUser } from "@/actions/users.actions";
import { getCaller } from "@/lib/auth";
import { Role } from "@/enums";
import {
  anonClient,
  BUCKET,
  createProduct,
  imagePath,
  must,
  PASSWORD,
  PNG,
  salePayload,
  serviceClient,
  signedIn,
  testEmail,
  testName,
  type Client,
  type TestUser,
} from "./helpers";

// Server actions run end to end against the real database; only Next's request plumbing is replaced

const session = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => session.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

let superAdmin: { client: Client; user: TestUser };
let admin: { client: Client; user: TestUser };
let editor: { client: Client; user: TestUser };
const service = serviceClient();

const actAs = (who: { client: Client }) => (session.client = who.client);

const item = (label: string, extra: Record<string, unknown> = {}) => ({ name: testName(label), price_pkr: 250, is_active: true, image_url: null, reason: "", ...extra });

beforeAll(async () => {
  [superAdmin, admin, editor] = await Promise.all([signedIn("superAdmin"), signedIn("admin"), signedIn("editor")]);
});

describe("getCaller", () => {
  it("reads the role from the database for each user", async () => {
    actAs(superAdmin);
    expect(await getCaller()).toMatchObject({ id: superAdmin.user.id, role: Role.SUPER_ADMIN });
    actAs(admin);
    expect(await getCaller()).toMatchObject({ role: Role.ADMIN });
    actAs(editor);
    expect(await getCaller()).toBeNull();
    session.client = anonClient();
    expect(await getCaller()).toBeNull();
  });
});

describe("items", () => {
  it("Admin adds an item with an uploaded image", async () => {
    actAs(admin);
    const path = imagePath("action");
    await must(admin.client.storage.from(BUCKET).upload(path, new Blob([new Uint8Array(PNG)], { type: "image/png" }), { contentType: "image/png" }));
    const image_url = admin.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    expect(await createItem(item("with-image", { image_url }))).toEqual({ ok: true });
    expect(await must(service.from("products").select("image_url").eq("name", testName("with-image")).single())).toEqual({ image_url });
  });

  it("refuses an image URL from outside the bucket", async () => {
    actAs(admin);
    expect(await createItem(item("bad-image", { image_url: "https://example.com/x.png" }))).toEqual({ ok: false, error: "Check the form fields" });
  });

  it("Editor cannot add items", async () => {
    actAs(editor);
    expect(await createItem(item("editor"))).toEqual({ ok: false, error: "You do not have permission to do this" });
  });

  it("Admin edit becomes a request with only the changed field; Super Admin approves it", async () => {
    const product = await createProduct("admin-edit");
    actAs(admin);
    const values = { name: product.name, price_pkr: 275, is_active: true, image_url: null, reason: "price up" };
    expect(await updateItem(product.id, values)).toEqual({ ok: true });
    expect(await updateItem(product.id, values)).toEqual({ ok: false, error: "This item already has a pending request" });
    expect(await deleteItem(product.id, { reason: "remove it" })).toEqual({ ok: false, error: "This item already has a pending request" });

    const request = await must(
      service.from("product_deletion_requests").select("id, new_name, new_price_pkr, new_image_url, old_values").eq("product_id", product.id).single(),
    );
    expect(request).toMatchObject({ new_name: null, new_price_pkr: 275, new_image_url: null, old_values: { price_pkr: 200 } });

    expect(await decideRequest({ requestId: request.id, approve: true, note: "" })).toEqual({ ok: false, error: "Only Super Admin can decide requests" });
    actAs(superAdmin);
    expect(await decideRequest({ requestId: request.id, approve: true, note: "" })).toEqual({ ok: true });
    expect(await must(service.from("products").select("price_pkr").eq("id", product.id).single())).toEqual({ price_pkr: 275 });
    expect(await decideRequest({ requestId: request.id, approve: true, note: "" })).toEqual({ ok: false, error: "Request not found or already decided" });
  });

  it("Admin edit with no changes is refused", async () => {
    const product = await createProduct("no-change");
    actAs(admin);
    expect(await updateItem(product.id, { name: product.name, price_pkr: 200, is_active: true, image_url: null, reason: "nothing" })).toEqual({
      ok: false,
      error: "Nothing was changed",
    });
  });

  it("Super Admin edits and deletes directly", async () => {
    const product = await createProduct("sa-direct");
    actAs(superAdmin);
    expect(await updateItem(product.id, { name: product.name, price_pkr: 500, is_active: false, image_url: null, reason: "" })).toEqual({ ok: true });
    expect(await deleteItem(product.id, { reason: "" })).toEqual({ ok: true });
    expect(await must(service.from("products").select("price_pkr, is_active, deleted_at").eq("id", product.id).single())).toMatchObject({
      price_pkr: 500,
      is_active: false,
      deleted_at: expect.any(String),
    });
  });
});

describe("users and login", () => {
  const newUser = (label: string, role: Role.ADMIN | Role.EDITOR = Role.ADMIN) => ({
    full_name: `IT ${label}`,
    email: testEmail(label),
    password: PASSWORD,
    role,
    can_sell: true,
  });
  const idOf = async (email: string) => (await must(service.auth.admin.listUsers({ perPage: 1000 }))).users.find((user) => user.email === email)!.id;

  it("only Super Admin manages users", async () => {
    actAs(admin);
    expect(await createUser(newUser("denied"))).toEqual({ ok: false, error: "You do not have permission to do this" });
    expect(await getUserEmails()).toEqual({});
    actAs(superAdmin);
    expect(await getUserEmails()).toMatchObject({ [admin.user.id]: admin.user.email });
  });

  it("created users are active with the chosen role and can sign in", async () => {
    actAs(superAdmin);
    const values = newUser("created");
    expect(await createUser(values)).toEqual({ ok: true });
    const id = await idOf(values.email);
    expect(await must(service.from("profiles").select("full_name, role, can_sell, is_active").eq("id", id).single())).toEqual({
      full_name: "IT created",
      role: "admin",
      can_sell: true,
      is_active: true,
    });

    session.client = anonClient();
    expect(await login({ email: values.email, password: PASSWORD })).toEqual({ ok: true });
    expect(await login({ email: values.email, password: "wrong-password" })).toEqual({ ok: false, error: "Wrong email or password" });
  });

  it("Editors are signed out of the dashboard", async () => {
    actAs(superAdmin);
    const values = newUser("pos-only", Role.EDITOR);
    expect(await createUser(values)).toEqual({ ok: true });
    const client = anonClient();
    session.client = client;
    expect(await login({ email: values.email, password: PASSWORD })).toEqual({ ok: false, error: "This account uses the POS app only." });
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it("deactivated users are told so, and can sign in again once reactivated", async () => {
    actAs(superAdmin);
    const values = newUser("deactivated");
    await createUser(values);
    const id = await idOf(values.email);
    const edit = { full_name: values.full_name, role: Role.ADMIN, can_sell: false } as const;

    expect(await updateUser(id, { ...edit, is_active: false })).toEqual({ ok: true });
    session.client = anonClient();
    expect(await login({ email: values.email, password: PASSWORD })).toEqual({ ok: false, error: "This account is deactivated" });

    actAs(superAdmin);
    expect(await updateUser(id, { ...edit, is_active: true })).toEqual({ ok: true });
    session.client = anonClient();
    expect(await login({ email: values.email, password: PASSWORD })).toEqual({ ok: true });
  });

  it("Super Admin accounts are protected", async () => {
    actAs(superAdmin);
    const edit = { full_name: "IT x", role: Role.ADMIN, can_sell: false, is_active: false } as const;
    expect(await updateUser(superAdmin.user.id, edit)).toEqual({ ok: false, error: "Super Admin accounts cannot be changed here" });
    expect(await deleteUser(superAdmin.user.id)).toEqual({ ok: false, error: "Super Admin accounts cannot be deleted" });
  });

  it("users without history can be deleted; users with sales cannot", async () => {
    actAs(superAdmin);
    const [plain, withSales] = [newUser("delete-me"), newUser("has-sales", Role.EDITOR)];
    await createUser(plain);
    await createUser(withSales);
    const [plainId, salesId] = [await idOf(plain.email), await idOf(withSales.email)];

    const product = await createProduct("history");
    const { items, ...sale } = salePayload(salesId, [{ product_id: product.id, product_name: product.name, unit_price_pkr: 200, qty: 1 }]);
    await must(service.from("sales").insert(sale));
    await must(service.from("sale_items").insert(items.map((line) => ({ ...line, sale_id: sale.id }))));

    expect(await deleteUser(plainId)).toEqual({ ok: true });
    expect(await must(service.from("profiles").select("id").eq("id", plainId))).toEqual([]);
    expect((await deleteUser(salesId)).error).toMatch(/Deactivate them instead/);
  });
});
