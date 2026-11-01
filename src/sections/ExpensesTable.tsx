"use client";

import { useState } from "react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Table from "@/components/Table";
import { ExpenseRequestType, ExpenseStatus } from "@/enums";
import type { Expense, ExpensesTableProps } from "@/types";
import { formatDate, formatPKR } from "@/utils/format";
import ExpenseForm from "./ExpenseForm";
import RemoveExpenseForm from "./RemoveExpenseForm";

type Dialog = { type: "add" } | { type: ExpenseRequestType; expense: Expense } | null;

const removals = [
  { type: ExpenseRequestType.CANCEL, label: "Cancel" },
  { type: ExpenseRequestType.DELETE, label: "Delete" },
];

export default function ExpensesTable({ expenses, pendingIds, role }: ExpensesTableProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <>
      <Button onClick={() => setDialog({ type: "add" })} className="self-start">
        + Add expense
      </Button>

      <Table headers={["Date", "Title", "Note", "Added by", "Amount", "Status", ""]} empty={!expenses.length}>
        {expenses.map((expense) => {
          const pending = pendingIds.includes(expense.id);
          const cancelled = expense.status === ExpenseStatus.CANCELLED;

          return (
            <tr key={expense.id}>
              <td className="whitespace-nowrap">{formatDate(expense.spent_on)}</td>
              <td className="font-semibold">{expense.title}</td>
              <td className="max-w-xs">{expense.note ?? "—"}</td>
              <td>{expense.created_by_name}</td>
              <td className="whitespace-nowrap">{formatPKR(expense.amount_pkr)}</td>
              <td>
                <div className="flex gap-1">
                  <Badge variant={cancelled ? "outline" : "solid"}>{cancelled ? "Cancelled" : "Active"}</Badge>
                  {pending && <Badge>Pending request</Badge>}
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  {removals.map((removal) => (
                    <Button
                      key={removal.type}
                      variant="secondary"
                      disabled={pending || (cancelled && removal.type === ExpenseRequestType.CANCEL)}
                      onClick={() => setDialog({ type: removal.type, expense })}
                    >
                      {removal.label}
                    </Button>
                  ))}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {dialog?.type === "add" && <ExpenseForm onClose={close} />}
      {dialog && dialog.type !== "add" && <RemoveExpenseForm expense={dialog.expense} type={dialog.type} role={role} onClose={close} />}
    </>
  );
}
