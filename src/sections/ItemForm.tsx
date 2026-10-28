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
import { createClient } from "@/lib/supabase/client";
import { itemFormSchema, type ItemFormProps, type ItemFormValues } from "@/types";

// Always a new path with upsert off, so a live image is never overwritten
async function uploadImage(file: File) {
  const supabase = createClient();
  const path = `products/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
  if (error) throw new Error("Image upload failed");
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export default function ItemForm({ product, role, onClose }: ItemFormProps) {
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

  async function onSubmit({ image, ...values }: ItemFormValues) {
    setServerError("");
    try {
      const image_url = image?.[0] ? await uploadImage(image[0]) : (product?.image_url ?? null);
      const result = product ? await updateItem(product.id, { ...values, image_url }) : await createItem({ ...values, image_url });
      if (!result.ok) return setServerError(result.error);
      onClose();
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

        <Input label="Image (optional, max 2 MB)" type="file" accept="image/jpeg,image/png,image/webp" error={errors.image?.message} {...register("image")} />

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
