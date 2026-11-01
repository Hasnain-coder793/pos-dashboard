"use client";

import { useState } from "react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Notice from "@/components/Notice";
import Table from "@/components/Table";
import type { Expense, ExpensesTableProps } from "@/types";
import { formatDate, formatDateTime, formatPKR } from "@/utils/format";
import DeleteExpenseForm from "./DeleteExpenseForm";
import ExpenseForm from "./ExpenseForm";

type Dialog = { type: "add" } | { type: "edit" | "delete"; expense: Expense } | null;

export default function ExpensesTable({ expenses, pendingIds, role }: ExpensesTableProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState("");
  const close = () => setDialog(null);
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  return (
    <>
      <Button onClick={() => setDialog({ type: "add" })} className="self-start">
        + Add expense
      </Button>

      <Notice message={notice} />

      <Table headers={["Date", "Title", "Amount", "Added by", "Added at", "Status", ""]} empty={!expenses.length}>
        {expenses.map((expense) => {
          const pending = pendingIds.includes(expense.id);

          return (
            <tr key={expense.id}>
              <td className="whitespace-nowrap">{formatDate(expense.spent_on)}</td>
              <td className="font-semibold">{expense.title}</td>
              <td className="whitespace-nowrap">{formatPKR(expense.amount_pkr)}</td>
              <td>{expense.created_by_name}</td>
              <td className="whitespace-nowrap">{formatDateTime(expense.created_at)}</td>
              <td>{pending ? <Badge>Pending change</Badge> : <Badge variant="solid">Added</Badge>}</td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" disabled={pending} onClick={() => setDialog({ type: "edit", expense })}>
                    Edit
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => setDialog({ type: "delete", expense })}>
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {dialog?.type === "add" && <ExpenseForm role={role} onClose={close} onDone={done} />}
      {dialog?.type === "edit" && <ExpenseForm expense={dialog.expense} role={role} onClose={close} onDone={done} />}
      {dialog?.type === "delete" && <DeleteExpenseForm expense={dialog.expense} role={role} onClose={close} onDone={done} />}
    </>
  );
}
