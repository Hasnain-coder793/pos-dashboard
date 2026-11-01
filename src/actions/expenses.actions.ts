"use server";

import { revalidatePath } from "next/cache";
import { ExpenseRequestType, ExpenseStatus, Role } from "@/enums";
import { getCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  decisionSchema,
  expenseRemovalSchema,
  expenseSchema,
  type ActionResult,
  type DecisionValues,
  type ExpenseRemovalValues,
  type ExpenseValues,
} from "@/types";
import { toErrorMessage } from "@/utils/errors";

// Admin and Super Admin; the database records who added it
export async function addExpense(values: ExpenseValues): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Check the form fields" };
  if (!(await getCaller())) return { ok: false, error: "You do not have permission to do this" };

  const { title, amount_pkr, spent_on, note } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ title, amount_pkr, spent_on, note: note || null });
  if (error) return { ok: false, error: toErrorMessage(error) };

  revalidatePath("/expenses");
  return { ok: true };
}

// Super Admin cancels or deletes directly; Admin sends a request with a reason
export async function removeExpense(id: string, values: ExpenseRemovalValues): Promise<ActionResult> {
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "You do not have permission to do this" };

  const parsed = expenseRemovalSchema(caller.role === Role.ADMIN).safeParse(values);
  if (!parsed.success) return { ok: false, error: "Give a reason (at least 3 characters)" };

  const { type, reason } = parsed.data;
  const supabase = await createClient();

  if (caller.role === Role.SUPER_ADMIN) {
    const change = type === ExpenseRequestType.DELETE ? { deleted_at: new Date().toISOString() } : { status: ExpenseStatus.CANCELLED };
    const { error } = await supabase.from("expenses").update(change).eq("id", id);
    if (error) return { ok: false, error: toErrorMessage(error) };
  } else {
    const { error } = await supabase.from("expense_requests").insert({ expense_id: id, request_type: type, reason });
    if (error) return { ok: false, error: toErrorMessage(error) };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

// The RPC re-checks super_admin and applies the change in one transaction
export async function decideExpenseRequest(values: DecisionValues): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const caller = await getCaller();
  if (caller?.role !== Role.SUPER_ADMIN) return { ok: false, error: "Only Super Admin can decide requests" };

  const supabase = await createClient();
  const { requestId, approve, note } = parsed.data;
  const { error } = await supabase.rpc("decide_expense_request", { p_request_id: requestId, p_approve: approve, p_note: note || null });
  if (error) return { ok: false, error: toErrorMessage(error) };

  revalidatePath("/expenses");
  return { ok: true };
}
