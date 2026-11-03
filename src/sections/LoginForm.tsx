"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { login } from "@/actions/auth.actions";
import Button from "@/components/Button";
import ErrorBanner from "@/components/ErrorBanner";
import Input from "@/components/Input";
import { loginSchema, type LoginValues } from "@/types";

const fields = [
  { name: "email", label: "Email", type: "email", autoComplete: "username" },
  { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
] as const;

export default function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setServerError("");
    const result = await login(values);
    if (!result.ok) return setServerError(result.error);
    router.replace("/items");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-secondary p-8 shadow-lg">
      <h1 className="text-3xl font-bold">POS Dashboard</h1>
      <p className="text-slate-600">Log in as Super Admin or Admin</p>

      {fields.map((field) => (
        <Input
          key={field.name}
          label={field.label}
          type={field.type}
          autoComplete={field.autoComplete}
          error={errors[field.name]?.message}
          {...register(field.name)}
        />
      ))}

      <ErrorBanner message={serverError} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
