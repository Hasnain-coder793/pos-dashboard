// Confirmation after a save, e.g. "Expense added"
export default function Notice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-md border border-primary bg-blue-50 p-3 text-sm font-semibold text-primary">✓ {message}</p>;
}
