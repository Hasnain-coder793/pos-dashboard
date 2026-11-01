"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/Modal";
import type { SaleRow } from "@/types";
import { formatDateTime, formatPKR } from "@/utils/format";

// Eye button that opens the sale as a printed-style receipt
export default function SaleReceipt({ sale }: { sale: SaleRow }) {
  const [open, setOpen] = useState(false);
  const details = [
    { label: "Time", value: formatDateTime(sale.sold_at) },
    { label: "Cashier", value: sale.cashier_name },
    { label: "Customer", value: sale.customer_name ?? "—" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`View receipt ${sale.receipt_no}`}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-primary hover:bg-blue-50"
      >
        <Eye className="size-5" />
      </button>

      {/* Portal: the button sits inside the sales table, whose td padding would otherwise leak into the receipt */}
      {open &&
        createPortal(
          <Modal title={`Receipt ${sale.receipt_no}`} onClose={() => setOpen(false)}>
            <div className="flex flex-col gap-1 text-sm">
              {details.map((detail) => (
                <div key={detail.label} className="flex justify-between">
                  <span className="text-slate-600">{detail.label}</span>
                  <span className="font-semibold">{detail.value}</span>
                </div>
              ))}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-dashed border-slate-300 text-left text-slate-600">
                  <th className="py-2 font-semibold">Item</th>
                  <th className="py-2 font-semibold">Qty</th>
                  <th className="py-2 font-semibold">Price</th>
                  <th className="py-2 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.sale_items?.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1">{item.product_name}</td>
                    <td className="py-1">{item.qty}</td>
                    <td className="py-1">{formatPKR(item.unit_price_pkr ?? 0)}</td>
                    <td className="py-1">{formatPKR(item.line_total_pkr)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-dashed border-slate-300 font-bold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2">{sale.total_items}</td>
                  <td />
                  <td className="pt-2">{formatPKR(sale.total_pkr)}</td>
                </tr>
              </tfoot>
            </table>
          </Modal>,
          document.body,
        )}
    </>
  );
}
