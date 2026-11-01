import Link from "next/link";
import { decideExpenseRequest } from "@/actions/expenses.actions";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { ExpenseRequestType, RequestStatus, Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ExpensesTabs from "@/sections/ExpensesTabs";
import RequestActions from "@/sections/RequestActions";
import type { ExpenseRequest } from "@/types";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

const statuses = Object.values(RequestStatus);

// "Old → requested" lines for each field the request changes; old values come from the snapshot taken at request time
function changes(request: ExpenseRequest) {
  if (request.request_type === ExpenseRequestType.DELETE) return ["Delete expense"];
  const old = request.old_values ?? request.expense;
  return [
    request.new_title && `Title: ${old?.title} → ${request.new_title}`,
    request.new_amount_pkr && `Amount: ${formatPKR(old?.amount_pkr ?? 0)} → ${formatPKR(request.new_amount_pkr)}`,
    request.new_spent_on && `Date: ${old?.spent_on ? formatDate(old.spent_on) : "—"} → ${formatDate(request.new_spent_on)}`,
  ].filter(Boolean);
}

export default async function ExpenseRequestsPage({ searchParams }: PageProps<"/expenses/requests">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const { status: param, page: pageParam } = await searchParams;
  const page = pageSchema.parse(pageParam);
  const status = statuses.find((s) => s === param) ?? RequestStatus.PENDING;
  const canDecide = profile.role === Role.SUPER_ADMIN;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("expense_requests")
    .select(
      `id, expense_id, request_type, status, reason, new_title, new_amount_pkr, new_spent_on, old_values,
       decision_note, decided_by_name, decided_at, created_by_name, created_at,
       expense:expenses(title, amount_pkr, spent_on)`,
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(...pageRange(page))
    .returns<ExpenseRequest[]>();
  const requests = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Expenses</h1>
      <ExpensesTabs active="/expenses/requests" />

      <div className="flex gap-2">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={cn("rounded-full border border-primary px-3 py-1 text-sm font-semibold capitalize text-primary hover:bg-blue-50", s === status && "bg-primary text-secondary hover:bg-blue-800")}
          >
            {s}
          </Link>
        ))}
      </div>

      <Table
        headers={["Expense", "Type", "Change", "Reason", "Requested", status === RequestStatus.PENDING ? (canDecide ? "Decision" : "Status") : "Decided"]}
        empty={!requests.length}
      >
        {requests.map((request) => (
          <tr key={request.id} className="align-top">
            <td className="font-semibold">{(request.old_values ?? request.expense)?.title ?? "—"}</td>
            <td>
              <Badge variant={request.request_type === ExpenseRequestType.DELETE ? "solid" : "outline"}>
                {request.request_type === ExpenseRequestType.DELETE ? "Delete" : "Update"}
              </Badge>
            </td>
            <td>
              {changes(request).map((line) => (
                <p key={line as string}>{line}</p>
              ))}
            </td>
            <td className="max-w-xs">{request.reason}</td>
            <td className="whitespace-nowrap">
              <p>{request.created_by_name}</p>
              <p className="text-slate-600">{formatDateTime(request.created_at)}</p>
            </td>
            <td>
              {request.status === RequestStatus.PENDING ? (
                canDecide ? (
                  <RequestActions requestId={request.id} decide={decideExpenseRequest} />
                ) : (
                  <Badge>Pending</Badge>
                )
              ) : (
                <div className="whitespace-nowrap">
                  <Badge variant={request.status === RequestStatus.APPROVED ? "solid" : "outline"}>{request.status}</Badge>
                  <p className="mt-1">{request.decided_by_name ?? "—"}</p>
                  <p className="text-slate-600">{request.decided_at && formatDateTime(request.decided_at)}</p>
                  {request.decision_note && <p className="text-slate-600">“{request.decision_note}”</p>}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} total={count ?? 0} params={{ status }} />
    </>
  );
}
