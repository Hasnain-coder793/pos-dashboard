"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { decideRequest } from "@/actions/requests.actions";
import Button from "@/components/Button";
import { decisionSchema, type DecisionValues, type RequestActionsProps } from "@/types";

const decisions = [
  { label: "Approve", approve: true, variant: "primary" },
  { label: "Reject", approve: false, variant: "secondary" },
] as const;

export default function RequestActions({ requestId }: RequestActionsProps) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema), defaultValues: { requestId, approve: true, note: "" } });

  async function onSubmit(values: DecisionValues) {
    setServerError("");
    const result = await decideRequest(values);
    if (!result.ok) setServerError(result.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-w-56 flex-col gap-2">
      <input
        placeholder="Note (optional)"
        className="h-9 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-primary"
        {...register("note")}
      />
      <div className="flex gap-2">
        {decisions.map((decision) => (
          <Button
            key={decision.label}
            type="submit"
            variant={decision.variant}
            disabled={isSubmitting}
            onClick={() => setValue("approve", decision.approve)}
            className="flex-1"
          >
            {decision.label}
          </Button>
        ))}
      </div>
      {(errors.note?.message || serverError) && <p className="text-xs font-semibold">⚠ {errors.note?.message || serverError}</p>}
    </form>
  );
}
