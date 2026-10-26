import type { BadgeProps } from "@/types";
import { cn } from "@/utils/cn";

const variants = {
  outline: "border border-primary bg-secondary text-primary",
  solid: "border border-primary bg-primary text-secondary",
};

export default function Badge({ variant = "outline", children }: BadgeProps) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", variants[variant])}>{children}</span>;
}
