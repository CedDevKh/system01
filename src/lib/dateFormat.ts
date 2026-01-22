export type DateFormat = "ISO" | "DMY" | "MDY";

export function normalizeDateFormat(value: unknown): DateFormat {
  if (value === "DMY" || value === "MDY" || value === "ISO") return value;
  return "ISO";
}

export function formatDateOnly(dateOnly: string, format: DateFormat) {
  // dateOnly: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;

  if (format === "ISO") return dateOnly;

  const yyyy = dateOnly.slice(0, 4);
  const mm = dateOnly.slice(5, 7);
  const dd = dateOnly.slice(8, 10);

  if (format === "DMY") return `${dd}/${mm}/${yyyy}`;
  if (format === "MDY") return `${mm}/${dd}/${yyyy}`;

  return dateOnly;
}

export function formatDateOnlyFromDate(d: Date, format: DateFormat) {
  return formatDateOnly(d.toISOString().slice(0, 10), format);
}
