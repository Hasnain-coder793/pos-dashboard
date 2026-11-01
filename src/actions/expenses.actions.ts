"use server";

import { revalidatePath } from "next/cache";
import { ExpenseRequestType, Role } from "@/enums";
import { getCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { decisionSchema, deleteSchema, expenseSchema, type ActionResult, type DecisionValues, type DeleteValues, type ExpenseValues } from "@/types";
import { toErrorMessage } from "@/utils/errors";

// Admin and Super Admin add directly; the database records who added it
export async function addExpense(values: ExpenseValues): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Check the form fields" };
  if (!(await getCaller())) return { ok: false, error: "You do not have permission to do this" };

  const { title, amount_pkr, spent_on } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ title, amount_pkr, spent_on });
  if (error) return { ok: false, error: toErrorMessage(error) };

  revalidatePath("/expenses");
  return { ok: true };
}

// Super Admin updates directly; Admin sends only the changed fields as a request
export async function updateExpense(id: string, values: ExpenseValues): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Check the form fields" };

  const caller = await getCaller();
  if (!caller) return { ok: false, error: "You do not have permission to do this" };

  const { title, amount_pkr, spent_on, reason } = parsed.data;
  const supabase = await createClient();

  if (caller.role === Role.SUPER_ADMIN) {
    const { error } = await supabase.from("expenses").update({ title, amount_pkr, spent_on }).eq("id", id);
    if (error) return { ok: false, error: toErrorMessage(error) };
  } else {
    if (reason.length < 3) return { ok: false, error: "Give a reason for the change" };

    const { data: expense } = await supabase.from("expenses").select("title, amount_pkr, spent_on").eq("id", id).single();
    if (!expense) return { ok: false, error: "Expense not found" };

    const changes = {
      new_title: title !== expense.title ? title : null,
      new_amount_pkr: amount_pkr !== expense.amount_pkr ? amount_pkr : null,
      new_spent_on: spent_on !== expense.spent_on ? spent_on : null,
    };
    if (Object.values(changes).every((value) => value === null)) return { ok: false, error: "Nothing was changed" };

    const { error } = await supabase.from("expense_requests").insert({ expense_id: id, request_type: ExpenseRequestType.UPDATE, reason, ...changes });
    if (error) return { ok: false, error: toErrorMessage(error) };
  }

  revalidatePath("/expenses", "layout");
  return { ok: true };
}

// Super Admin deletes directly; Admin sends a delete request
export async function deleteExpense(id: string, values: DeleteValues): Promise<ActionResult> {
  const caller = await getCaller();
  if (!caller) return { ok: false, error: "You do not have permission to do this" };

  const parsed = deleteSchema(caller.role === Role.ADMIN).safeParse(values);
  if (!parsed.success) return { ok: false, error: "Give a reason for the delete" };

  const supabase = await createClient();

  if (caller.role === Role.SUPER_ADMIN) {
    const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: toErrorMessage(error) };
  } else {
    const { error } = await supabase
      .from("expense_requests")
      .insert({ expense_id: id, request_type: ExpenseRequestType.DELETE, reason: parsed.data.reason });
    if (error) return { ok: false, error: toErrorMessage(error) };
  }

  revalidatePath("/expenses", "layout");
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

  revalidatePath("/expenses", "layout");
  return { ok: true };
}
