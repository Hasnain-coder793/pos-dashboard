"use client";

import { useState } from "react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Table from "@/components/Table";
import type { ItemsTableProps, Product } from "@/types";
import { formatDateTime, formatPKR } from "@/utils/format";
import DeleteForm from "./DeleteForm";
import ItemForm from "./ItemForm";

type Dialog = { type: "add" } | { type: "edit" | "delete"; product: Product } | null;

export default function ItemsTable({ products, pendingIds, role }: ItemsTableProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <>
      <Button onClick={() => setDialog({ type: "add" })} className="self-start">
        + Add item
      </Button>

      <Table headers={["Image", "Name", "Price", "Status", "Updated", ""]} empty={!products.length}>
        {products.map((product) => {
          const pending = pendingIds.includes(product.id);
          const locked = pending || !!product.deleted_at;

          return (
            <tr key={product.id}>
              <td>
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} className="size-10 rounded-md object-cover" />
                ) : (
                  <div className="size-10 rounded-md bg-slate-100" />
                )}
              </td>
              <td className="font-semibold">{product.name}</td>
              <td>{formatPKR(product.price_pkr)}</td>
              <td>
                <div className="flex gap-1">
                  {product.deleted_at ? (
                    <Badge variant="solid">Deleted</Badge>
                  ) : (
                    <Badge variant={product.is_active ? "solid" : "outline"}>{product.is_active ? "Active" : "Inactive"}</Badge>
                  )}
                  {pending && <Badge>Pending change</Badge>}
                </div>
              </td>
              <td className="whitespace-nowrap">{formatDateTime(product.updated_at)}</td>
              <td>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" disabled={locked} onClick={() => setDialog({ type: "edit", product })}>
                    Edit
                  </Button>
                  <Button variant="secondary" disabled={locked} onClick={() => setDialog({ type: "delete", product })}>
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {dialog?.type === "add" && <ItemForm role={role} onClose={close} />}
      {dialog?.type === "edit" && <ItemForm product={dialog.product} role={role} onClose={close} />}
      {dialog?.type === "delete" && <DeleteForm product={dialog.product} role={role} onClose={close} />}
    </>
  );
}
