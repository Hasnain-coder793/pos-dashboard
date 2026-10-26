// Shared by every page's loading.tsx
export default function TableSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-48 rounded-md bg-neutral-200" />
      <div className="h-10 w-full max-w-md rounded-md bg-neutral-200" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-12 rounded-md bg-neutral-100" />
      ))}
    </div>
  );
}
