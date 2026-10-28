"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createUser, updateUser } from "@/actions/users.actions";
import Button from "@/components/Button";
import Checkbox from "@/components/Checkbox";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import Modal from "@/components/Modal";
import { Role } from "@/enums";
import { createUserSchema, updateUserSchema, type CreateUserValues, type UserFormProps } from "@/types";

type Values = CreateUserValues & { is_active: boolean };

const roles = [
  { value: Role.ADMIN, label: "Admin" },
  { value: Role.EDITOR, label: "Editor (POS only)" },
];

export default function UserForm({ user, onClose }: UserFormProps) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(user ? updateUserSchema : createUserSchema) as never,
    defaultValues: {
      full_name: user?.full_name ?? "",
      role: user?.role === Role.EDITOR ? Role.EDITOR : Role.ADMIN,
      can_sell: user?.can_sell ?? false,
      is_active: user?.is_active ?? true,
    },
  });

  const fields = [
    { name: "full_name", label: "Full name", type: "text", show: true },
    { name: "email", label: "Email", type: "email", show: !user },
    { name: "password", label: "Temporary password", type: "password", show: !user },
  ] as const;

  const role = useWatch({ control, name: "role" });

  async function onSubmit(values: Values) {
    setServerError("");
    const result = user ? await updateUser(user.id, values) : await createUser(values);
    if (!result.ok) return setServerError(result.error);
    onClose();
  }

  return (
    <Modal title={user ? "Edit user" : "Create user"} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {fields
          .filter((field) => field.show)
          .map((field) => (
            <Input key={field.name} label={field.label} type={field.type} error={errors[field.name]?.message} {...register(field.name)} />
          ))}

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Role
          <select {...register("role")} className="h-10 cursor-pointer rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-primary">
            {roles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {role === Role.ADMIN && <Checkbox label="Can sell in the POS" {...register("can_sell")} />}
        {user && <Checkbox label="Active (can sign in)" {...register("is_active")} />}

        <ErrorBanner message={serverError} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
