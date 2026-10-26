import type { ButtonProps } from "@/types";
import { cn } from "@/utils/cn";

const variants = {
  primary: "bg-primary text-secondary hover:bg-neutral-800",
  secondary: "border border-primary bg-secondary text-primary hover:bg-neutral-100",
};

export default function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-10 cursor-pointer rounded-md px-4 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-neutral-300 disabled:text-neutral-500",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
