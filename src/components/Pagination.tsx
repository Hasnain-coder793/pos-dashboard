import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { PaginationProps } from "@/types";
import { cn } from "@/utils/cn";
import { PAGE_SIZE } from "@/utils/pagination";

// pageKey lets two lists on one page keep separate page numbers in the URL
export default function Pagination({ page, total, params = {}, pageKey = "page" }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `?${new URLSearchParams({ ...params, [pageKey]: String(p) })}`;

  // A page past the end (typed into the URL) goes to the last page
  if (page > pages) redirect(href(pages));

  const arrows = [
    { label: "Previous page", icon: ChevronLeft, page: page - 1, disabled: page === 1 },
    { label: "Next page", icon: ChevronRight, page: page + 1, disabled: page === pages },
  ];

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <span className="text-neutral-600">
        Page {page} of {pages}
      </span>
      {arrows.map(({ label, icon: Icon, ...arrow }) => (
        <Link
          key={label}
          href={href(arrow.page)}
          aria-label={label}
          aria-disabled={arrow.disabled}
          className={cn(
            "rounded-md border border-primary p-1.5 hover:bg-neutral-100",
            arrow.disabled && "pointer-events-none border-neutral-300 text-neutral-300",
          )}
        >
          <Icon className="size-4" />
        </Link>
      ))}
    </div>
  );
}
