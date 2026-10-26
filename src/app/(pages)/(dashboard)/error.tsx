"use client";

import Button from "@/components/Button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-neutral-600">The page could not be loaded. Please try again.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
