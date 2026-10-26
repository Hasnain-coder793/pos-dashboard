import Link from "next/link";
import type { PaginationProps } from "@/types";

export default function Pagination({ page, total, pageSize, params }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `?${new URLSearchParams({ ...params, page: String(p) })}`;
  const links = [
    { label: "Previous", page: page - 1, show: page > 1 },
    { label: "Next", page: page + 1, show: page < pages },
  ];

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-600">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {links.map((link) =>
          link.show ? (
            <Link key={link.label} href={href(link.page)} className="rounded-md border border-primary px-3 py-1.5 font-semibold hover:bg-neutral-100">
              {link.label}
            </Link>
          ) : null,
        )}
      </div>
    </div>
  );
}
