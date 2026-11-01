"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { removeExpense } from "@/actions/expenses.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { ExpenseRequestType, Role } from "@/enums";
import { expenseRemovalSchema, type ExpenseRemovalValues, type RemoveExpenseFormProps } from "@/types";
import { formatPKR } from "@/utils/format";

// Cancelled expenses stay listed but stop counting; deleted ones are hidden
const actions = {
  [ExpenseRequestType.CANCEL]: { verb: "Cancel", effect: "It stays in the list but is no longer counted in the total." },
  [ExpenseRequestType.DELETE]: { verb: "Delete", effect: "It is removed from the list and the total." },
};

export default function RemoveExpenseForm({ expense, type, role, onClose }: RemoveExpenseFormProps) {
  const isRequest = role === Role.ADMIN;
  const { verb, effect } = actions[type];
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseRemovalValues>({ resolver: zodResolver(expenseRemovalSchema(isRequest)), defaultValues: { type, reason: "" } });

  async function onSubmit(values: ExpenseRemovalValues) {
    setServerError("");
    const result = await removeExpense(expense.id, values);
    if (!result.ok) return setServerError(result.error);
    onClose();
  }

  return (
    <Modal title={isRequest ? `Request ${verb.toLowerCase()}` : `${verb} expense`} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm">
          {isRequest ? `Ask a Super Admin to ${verb.toLowerCase()} ` : `${verb} `}
          <span className="font-semibold">
            {expense.title} · {formatPKR(expense.amount_pkr)}
          </span>
          ? {effect}
        </p>

        {isRequest && <Input label="Reason" error={errors.reason?.message} {...register("reason")} />}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isRequest ? "Send request" : verb}
        </Button>
      </form>
    </Modal>
  );
}
