"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { deleteExpense } from "@/actions/expenses.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { Role } from "@/enums";
import { deleteSchema, type DeleteExpenseFormProps, type DeleteValues } from "@/types";
import { formatPKR } from "@/utils/format";

export default function DeleteExpenseForm({ expense, role, onClose, onDone }: DeleteExpenseFormProps) {
  const isRequest = role === Role.ADMIN;
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteValues>({ resolver: zodResolver(deleteSchema(isRequest)), defaultValues: { reason: "" } });

  async function onSubmit(values: DeleteValues) {
    setServerError("");
    const result = await deleteExpense(expense.id, values);
    if (!result.ok) return setServerError(result.error);
    onDone(isRequest ? "Delete request sent to Super Admin" : "Expense deleted");
  }

  return (
    <Modal title={isRequest ? "Request delete" : "Delete expense"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm">
          {isRequest ? "Ask a Super Admin to delete " : "Delete "}
          <span className="font-semibold">
            {expense.title} · {formatPKR(expense.amount_pkr)}
          </span>
          ? It is removed from the list and the total.
        </p>

        {isRequest && <Input label="Reason" error={errors.reason?.message} {...register("reason")} />}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isRequest ? "Send request" : "Delete"}
        </Button>
      </form>
    </Modal>
  );
}
