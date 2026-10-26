"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/enums";
import { getCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decisionSchema, type ActionResult, type DecisionValues } from "@/types";
import { toErrorMessage } from "@/utils/errors";

// The RPC re-checks super_admin and applies the change in one transaction
export async function decideRequest(values: DecisionValues): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const caller = await getCaller();
  if (caller?.role !== Role.SUPER_ADMIN) return { ok: false, error: "Only Super Admin can decide requests" };

  const supabase = await createClient();
  const { requestId, approve, note } = parsed.data;
  const { error } = await supabase.rpc("decide_product_request", { p_request_id: requestId, p_approve: approve, p_note: note || null });
  if (error) return { ok: false, error: toErrorMessage(error) };

  revalidatePath("/items", "layout");
  return { ok: true };
}
