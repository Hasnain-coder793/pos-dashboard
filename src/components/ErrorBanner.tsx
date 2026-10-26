export default function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-primary p-3 text-sm font-semibold text-secondary">⚠ {message}</p>;
}
