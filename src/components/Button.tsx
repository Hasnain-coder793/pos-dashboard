import type { ButtonProps } from "@/types";
import { cn } from "@/utils/cn";

const variants = {
  primary: "bg-linear-to-r from-primary to-blue-600 text-secondary hover:from-blue-800 hover:to-blue-700",
  secondary: "border border-primary bg-secondary text-primary hover:bg-blue-50",
};

export default function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-10 cursor-pointer rounded-md px-4 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-300 disabled:text-slate-600",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
