import Link from "next/link";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import { RequestStatus, RequestType, Role } from "@/enums";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ItemsTabs from "@/sections/ItemsTabs";
import RequestActions from "@/sections/RequestActions";
import type { ItemRequest } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime, formatPKR } from "@/utils/format";
import { pageRange, pageSchema } from "@/utils/pagination";

const statuses = Object.values(RequestStatus);

// "Old → requested" lines for each field the request changes; old values come from the snapshot taken at request time
function changes(request: ItemRequest) {
  if (request.request_type === RequestType.DELETE) return ["Remove from POS"];
  const product = request.old_values ?? request.product;
  return [
    request.new_name && `Name: ${product?.name} → ${request.new_name}`,
    request.new_price_pkr && `Price: ${formatPKR(product?.price_pkr ?? 0)} → ${formatPKR(request.new_price_pkr)}`,
    request.new_image_url && "New image",
  ].filter(Boolean);
}

export default async function RequestsPage({ searchParams }: PageProps<"/items/requests">) {
  const profile = await requireRole(Role.SUPER_ADMIN, Role.ADMIN);
  const { status: param, page: pageParam } = await searchParams;
  const page = pageSchema.parse(pageParam);
  const status = statuses.find((s) => s === param) ?? RequestStatus.PENDING;
  const canDecide = profile.role === Role.SUPER_ADMIN;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("product_deletion_requests")
    .select(
      `id, request_type, status, reason, new_name, new_price_pkr, new_image_url, decision_note, old_values, created_at, decided_at,
       product:products(name, price_pkr, image_url),
       requester:profiles!product_deletion_requests_requested_by_fkey(full_name),
       decider:profiles!product_deletion_requests_decided_by_fkey(full_name)`,
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(...pageRange(page))
    .returns<ItemRequest[]>();
  const requests = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Items</h1>
      <ItemsTabs active="/items/requests" />

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
        headers={["Item", "Type", "Change", "Reason", "Requested", status === RequestStatus.PENDING ? (canDecide ? "Decision" : "Status") : "Decided"]}
        empty={!requests.length}
      >
        {requests.map((request) => (
          <tr key={request.id} className="align-top">
            <td className="font-semibold">{request.product?.name}</td>
            <td>
              <Badge variant={request.request_type === RequestType.DELETE ? "solid" : "outline"}>
                {request.request_type === RequestType.DELETE ? "Delete" : "Update"}
              </Badge>
            </td>
            <td>
              {changes(request).map((line) => (
                <p key={line as string}>{line}</p>
              ))}
              {request.new_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.new_image_url} alt="Requested" className="mt-1 size-12 rounded-md object-cover" />
              )}
            </td>
            <td className="max-w-xs">{request.reason}</td>
            <td className="whitespace-nowrap">
              <p>{request.requester?.full_name ?? "—"}</p>
              <p className="text-slate-600">{formatDateTime(request.created_at)}</p>
            </td>
            <td>
              {request.status === RequestStatus.PENDING ? (
                canDecide ? (
                  <RequestActions requestId={request.id} />
                ) : (
                  <Badge>Pending</Badge>
                )
              ) : (
                <div className="whitespace-nowrap">
                  <Badge variant={request.status === RequestStatus.APPROVED ? "solid" : "outline"}>{request.status}</Badge>
                  <p className="mt-1">{request.decider?.full_name ?? "—"}</p>
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
