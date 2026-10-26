"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { deleteItem } from "@/actions/items.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { Role } from "@/enums";
import { deleteSchema, type DeleteFormProps, type DeleteValues } from "@/types";

export default function DeleteForm({ product, role, onClose }: DeleteFormProps) {
  const isRequest = role === Role.ADMIN;
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteValues>({ resolver: zodResolver(deleteSchema(isRequest)), defaultValues: { reason: "" } });

  async function onSubmit(values: DeleteValues) {
    setServerError("");
    const result = await deleteItem(product.id, values);
    if (!result.ok) return setServerError(result.error);
    onClose();
  }

  return (
    <Modal title={isRequest ? "Request delete" : "Delete item"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm">
          {isRequest ? "Ask a Super Admin to delete " : "Remove "}
          <span className="font-semibold">{product.name}</span> from the POS? Past sales keep it.
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
