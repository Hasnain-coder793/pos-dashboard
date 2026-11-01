"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createItem, updateItem } from "@/actions/items.actions";
import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { Role } from "@/enums";
import { itemFormSchema, type ItemFormProps, type ItemFormValues } from "@/types";

export default function ItemForm({ product, role, onClose, onDone }: ItemFormProps) {
  const isRequest = !!product && role === Role.ADMIN;
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema(isRequest)),
    defaultValues: { name: product?.name ?? "", price_pkr: product?.price_pkr, is_active: product?.is_active ?? true, reason: "" },
  });

  const fields = [
    { name: "name", label: "Name", type: "text", show: true },
    { name: "price_pkr", label: "Price (PKR)", type: "number", show: true },
    { name: "reason", label: "Reason for change", type: "text", show: isRequest },
  ] as const;

  async function onSubmit(values: ItemFormValues) {
    setServerError("");
    try {
      const result = product ? await updateItem(product.id, values) : await createItem(values);
      if (!result.ok) return setServerError(result.error);
      onDone(isRequest ? "Change request sent to Super Admin" : product ? "Item updated" : "Item added");
    } catch (error) {
      setServerError((error as Error).message);
    }
  }

  return (
    <Modal title={product ? (isRequest ? "Request a change" : "Edit item") : "Add item"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {fields
          .filter((field) => field.show)
          .map((field) => (
            <Input
              key={field.name}
              label={field.label}
              type={field.type}
              error={errors[field.name]?.message}
              {...register(field.name, { valueAsNumber: field.type === "number" })}
            />
          ))}

        {!isRequest && <Checkbox label="Active (shown in the POS)" {...register("is_active")} />}
        {isRequest && <p className="text-sm text-slate-600">A Super Admin must approve this change before it reaches the POS.</p>}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isRequest ? "Send request" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
