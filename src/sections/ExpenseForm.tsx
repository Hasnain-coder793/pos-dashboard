"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addExpense } from "@/actions/expenses.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { expenseSchema, type ExpenseFormProps, type ExpenseValues } from "@/types";
import { karachiToday } from "@/utils/date-range";

const fields = [
  { name: "title", label: "Title", type: "text" },
  { name: "amount_pkr", label: "Amount (PKR)", type: "number" },
  { name: "spent_on", label: "Date", type: "date" },
  { name: "note", label: "Note (optional)", type: "text" },
] as const;

export default function ExpenseForm({ onClose }: ExpenseFormProps) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseValues>({ resolver: zodResolver(expenseSchema), defaultValues: { title: "", spent_on: karachiToday(), note: "" } });

  async function onSubmit(values: ExpenseValues) {
    setServerError("");
    const result = await addExpense(values);
    if (!result.ok) return setServerError(result.error);
    onClose();
  }

  return (
    <Modal title="Add expense" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {fields.map((field) => (
          <Input
            key={field.name}
            label={field.label}
            type={field.type}
            max={field.type === "date" ? karachiToday() : undefined}
            error={errors[field.name]?.message}
            {...register(field.name, { valueAsNumber: field.type === "number" })}
          />
        ))}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Add expense"}
        </Button>
      </form>
    </Modal>
  );
}
