"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addExpense, updateExpense } from "@/actions/expenses.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { Role } from "@/enums";
import { expenseFormSchema, type ExpenseFormProps, type ExpenseValues } from "@/types";
import { karachiToday } from "@/utils/date-range";

export default function ExpenseForm({ expense, role, onClose, onDone }: ExpenseFormProps) {
  const isRequest = !!expense && role === Role.ADMIN;
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseFormSchema(isRequest)),
    defaultValues: { title: expense?.title ?? "", amount_pkr: expense?.amount_pkr, spent_on: expense?.spent_on ?? karachiToday(), reason: "" },
  });

  const fields = [
    { name: "title", label: "Title", type: "text", show: true },
    { name: "amount_pkr", label: "Amount (PKR)", type: "number", show: true },
    { name: "spent_on", label: "Date", type: "date", show: true },
    { name: "reason", label: "Reason for change", type: "text", show: isRequest },
  ] as const;

  async function onSubmit(values: ExpenseValues) {
    setServerError("");
    const result = expense ? await updateExpense(expense.id, values) : await addExpense(values);
    if (!result.ok) return setServerError(result.error);
    onDone(isRequest ? "Change request sent to Super Admin" : expense ? "Expense updated" : "Expense added");
  }

  return (
    <Modal title={expense ? (isRequest ? "Request a change" : "Edit expense") : "Add expense"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {fields
          .filter((field) => field.show)
          .map((field) => (
            <Input
              key={field.name}
              label={field.label}
              type={field.type}
              max={field.type === "date" ? karachiToday() : undefined}
              error={errors[field.name]?.message}
              {...register(field.name, { valueAsNumber: field.type === "number" })}
            />
          ))}

        {isRequest && <p className="text-sm text-slate-600">A Super Admin must approve this change.</p>}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isRequest ? "Send request" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
