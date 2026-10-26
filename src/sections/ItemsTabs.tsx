import Link from "next/link";
import { cn } from "@/utils/cn";

const tabs = [
  { href: "/items", label: "Items" },
  { href: "/items/requests", label: "Change Requests" },
];

export default function ItemsTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-2 border-b border-neutral-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-semibold hover:bg-neutral-100",
            active === tab.href ? "border-primary" : "border-transparent text-neutral-500",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
