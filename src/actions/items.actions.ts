"use server";

import { revalidatePath } from "next/cache";
import { RequestType, Role } from "@/enums";
import { getCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteSchema, itemSchema, type ActionResult, type DeleteValues, type ItemValues } from "@/types";
import { toErrorMessage } from "@/utils/errors";

export async function createItem(values: ItemValues): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Check the form fields" };
  if (!(await getCaller())) return { ok: false, error: "You do not have permission to do this" };

  const { name, price_pkr, is_active, image_url } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({ name, price_pkr, is_active, image_url });
  if (error) return { ok: false, error: toErrorMessage(error) };

  revalidatePath("/items");
  return { ok: true };
}

// Super Admin updates directly; Admin sends only the changed fields as a request
export async function updateItem(id: string, values: ItemValues): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Check the form fields" };

  const caller = await getCaller();
  if (!caller) return { ok: false, error: "You do not have permission to do this" };

  const { name, price_pkr, is_active, image_url, reason } = parsed.data;
  const supabase = await createClient();

  if (caller.role === Role.SUPER_ADMIN) {
    const { error } = await supabase.from("products").update({ name, price_pkr, is_active, image_url }).eq("id", id);
    if (error) return { ok: false, error: toErrorMessage(error) };
  } else {
    if (reason.length < 3) return { ok: false, error: "Give a reason for the change" };

    const { data: product } = await supabase.from("products").select("name, price_pkr, image_url").eq("id", id).single();
    if (!product) return { ok: false, error: "Item not found" };

    const changes = {
      new_name: name !== product.name ? name : null,
      new_price_pkr: price_pkr !== product.price_pkr ? price_pkr : null,
      new_image_url: image_url !== product.image_url ? image_url : null,
    };
    if (Object.values(changes).every((value) => value === null)) return { ok: false, error: "Nothing was changed" };

    const { error } = await supabase
      .from("product_deletion_requests")
      .insert({ product_id: id, requested_by: caller.id, request_type: RequestType.UPDATE, reason, ...changes });
    if (error) return { ok: false, error: toErrorMessage(error) };
  }

  revalidatePath("/items");
  return { ok: true };
}

// Super Admin soft-deletes directly; Admin sends a delete request
export async function deleteItem(id: string, values: DeleteValues): Promise<ActionResult> {
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "You do not have permission to do this" };

  const parsed = deleteSchema(caller.role === Role.ADMIN).safeParse(values);
  if (!parsed.success) return { ok: false, error: "Give a reason for the delete" };

  const supabase = await createClient();

  if (caller.role === Role.SUPER_ADMIN) {
    const { error } = await supabase.from("products").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: toErrorMessage(error) };
  } else {
    const { error } = await supabase
      .from("product_deletion_requests")
      .insert({ product_id: id, requested_by: caller.id, request_type: RequestType.DELETE, reason: parsed.data.reason });
    if (error) return { ok: false, error: toErrorMessage(error) };
  }

  revalidatePath("/items");
  return { ok: true };
}
