export function formatPKR(amount: number): string {
  return `Rs ${amount.toLocaleString("en-US")}`;
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}
