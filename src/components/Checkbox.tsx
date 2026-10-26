import type { ComponentProps } from "react";

export default function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-4 cursor-pointer accent-primary" {...props} />
      {label}
    </label>
  );
}
