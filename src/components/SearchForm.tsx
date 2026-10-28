import type { ReactNode } from "react";
import Button from "./Button";

// GET form: the search lives in the URL, so the server page reads it from searchParams
export default function SearchForm({ placeholder, defaultValue, children }: { placeholder: string; defaultValue: string; children?: ReactNode }) {
  return (
    <form className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={50}
        className="h-10 w-full max-w-xs rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-primary"
      />
      {children}
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
