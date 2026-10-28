import type { TestProject } from "vitest/node";
import { anonClient, BUCKET, PASSWORD, PREFIX, serviceClient, USERS, type TestUser, type UserKey } from "./shared";

// Removes every row and file the tests created, including leftovers from an interrupted run
async function cleanup() {
  const service = serviceClient();
  const check = ({ error }: { error: unknown }) => {
    if (error) throw error;
  };

  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  const userIds = (list?.users ?? []).filter((user) => user.email?.startsWith(PREFIX)).map((user) => user.id);
  const { data: products } = await service.from("products").select("id").ilike("name", "IT-%");
  const productIds = (products ?? []).map((product) => product.id);

  if (userIds.length) {
    const { data: sales } = await service.from("sales").select("id").in("created_by", userIds);
    const saleIds = (sales ?? []).map((sale) => sale.id);
    if (saleIds.length) {
      check(await service.from("sale_items").delete().in("sale_id", saleIds));
      check(await service.from("sales").delete().in("id", saleIds));
    }
    check(await service.from("product_deletion_requests").delete().in("requested_by", userIds));
    check(await service.from("activity_log").delete().in("user_id", userIds));
  }
  if (productIds.length) {
    check(await service.from("product_deletion_requests").delete().in("product_id", productIds));
    check(await service.from("activity_log").delete().in("entity_id", productIds));
    check(await service.from("products").delete().in("id", productIds));
  }

  const { data: files } = await service.storage.from(BUCKET).list("products", { search: PREFIX, limit: 1000 });
  if (files?.length) await service.storage.from(BUCKET).remove(files.map((file) => `products/${file.name}`));

  for (const id of userIds) check(await service.auth.admin.deleteUser(id));
}

export default async function setup(project: TestProject) {
  await cleanup();

  const run = Date.now().toString(36);
  const service = serviceClient();
  const users = {} as Record<UserKey, TestUser>;

  for (const [key, profile] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const email = `${PREFIX}${run}-${key.toLowerCase()}@example.com`;
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `IT ${key}` } });
    if (error) throw error;
    const { error: profileError } = await service.from("profiles").update({ ...profile, is_active: true }).eq("id", data.user.id);
    if (profileError) throw profileError;

    const { data: signIn, error: signInError } = await anonClient().auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw signInError;
    users[key] = { id: data.user.id, email, access_token: signIn.session.access_token, refresh_token: signIn.session.refresh_token };
  }

  project.provide("run", run);
  project.provide("users", users);
  return cleanup;
}
