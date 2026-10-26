import { SalesPeriod } from "@/enums";

// Karachi is UTC+5 all year (no DST), so a local midnight is "<date>T00:00:00+05:00"
const toKarachiStart = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00+05:00`).toISOString();

export const karachiToday = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Returns [from, to) for the period that contains `date` (YYYY-MM-DD). Weeks start on Monday.
export function getDateRange(period: SalesPeriod, date: string) {
  const start = new Date(`${date}T00:00:00Z`);

  if (period === SalesPeriod.WEEK) start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === SalesPeriod.MONTH) start.setUTCDate(1);
  if (period === SalesPeriod.YEAR) start.setUTCMonth(0, 1);

  const end = new Date(start);
  if (period === SalesPeriod.DAY) end.setUTCDate(end.getUTCDate() + 1);
  if (period === SalesPeriod.WEEK) end.setUTCDate(end.getUTCDate() + 7);
  if (period === SalesPeriod.MONTH) end.setUTCMonth(end.getUTCMonth() + 1);
  if (period === SalesPeriod.YEAR) end.setUTCFullYear(end.getUTCFullYear() + 1);

  return { from: toKarachiStart(start), to: toKarachiStart(end) };
}
