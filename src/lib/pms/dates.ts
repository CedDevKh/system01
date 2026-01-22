export function parseDateOnlyToUtcMidnight(dateOnly: string) {
  // dateOnly: YYYY-MM-DD
  // We store date-only concepts as UTC midnight for MVP.
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d;
}

export function formatUtcDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function enumerateDateOnly(from: Date, toExclusive: Date) {
  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor < toExclusive) {
    dates.push(formatUtcDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
