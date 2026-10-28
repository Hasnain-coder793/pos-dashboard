import type { InputProps } from "@/types";
import { cn } from "@/utils/cn";

export default function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <input
        className={cn(
          "h-10 w-full rounded-md border border-slate-300 bg-secondary px-3 text-sm font-normal outline-none focus:border-primary",
          "file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:font-semibold file:hover:underline",
          error && "border-2 border-primary",
          className,
        )}
        {...props}
      />
      {error && <span className="text-sm font-semibold">⚠ {error}</span>}
    </label>
  );
}
