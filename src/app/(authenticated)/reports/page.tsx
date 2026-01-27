import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatUtcDateOnly, parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

type ReportPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

type ReportMode = "cash" | "accrual";

function addUtcDays(dateOnly: string, deltaDays: number) {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatUtcDateOnly(d);
}

function startOfUtcMonth(dateOnly: string) {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(1);
  return formatUtcDateOnly(d);
}

function endOfPreviousUtcMonth(dateOnly: string) {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  // Go to first day of this month, then back one day.
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth(), 1);
  d.setUTCDate(0);
  return formatUtcDateOnly(d);
}

function startOfPreviousUtcMonth(dateOnly: string) {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return formatUtcDateOnly(d);
}

function parsePreset(input: unknown): ReportPreset {
  const s = typeof input === "string" ? input : "";
  if (
    s === "today" ||
    s === "yesterday" ||
    s === "last7" ||
    s === "last30" ||
    s === "thisMonth" ||
    s === "lastMonth" ||
    s === "custom"
  ) {
    return s;
  }
  return "today";
}

function parseMode(input: unknown): ReportMode {
  const s = typeof input === "string" ? input : "";
  return s === "cash" ? "cash" : "accrual";
}

function resolveRange(params: {
  today: string;
  preset: ReportPreset;
  start?: string;
  end?: string;
}) {
  if (params.preset === "custom") {
    const startKey = params.start || params.today;
    const endKey = params.end || startKey;
    return { startKey, endKey };
  }

  if (params.preset === "yesterday") {
    const day = addUtcDays(params.today, -1);
    return { startKey: day, endKey: day };
  }

  if (params.preset === "last7") {
    return { startKey: addUtcDays(params.today, -6), endKey: params.today };
  }

  if (params.preset === "last30") {
    return { startKey: addUtcDays(params.today, -29), endKey: params.today };
  }

  if (params.preset === "thisMonth") {
    return { startKey: startOfUtcMonth(params.today), endKey: params.today };
  }

  if (params.preset === "lastMonth") {
    const startKey = startOfPreviousUtcMonth(params.today);
    const endKey = endOfPreviousUtcMonth(params.today);
    return { startKey, endKey };
  }

  return { startKey: params.today, endKey: params.today };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();
  const dateFormat = await getCurrentUserDateFormat();

  if (!canManageStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Reports" />
        <p className="text-sm text-muted-foreground">Not authorized.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const preset = parsePreset(sp.preset);
  const mode = parseMode(sp.mode);

  const today = formatUtcDateOnly(new Date());
  const customStart = typeof sp.start === "string" ? sp.start : "";
  const customEnd = typeof sp.end === "string" ? sp.end : "";

  let { startKey, endKey } = resolveRange({
    today,
    preset,
    start: customStart,
    end: customEnd,
  });

  // Validate + normalize date ordering.
  try {
    const startDate = parseDateOnlyToUtcMidnight(startKey);
    const endDate = parseDateOnlyToUtcMidnight(endKey);
    if (endDate < startDate) {
      // swap
      const tmp = startKey;
      startKey = endKey;
      endKey = tmp;
    }
  } catch {
    startKey = today;
    endKey = today;
  }

  const startDate = parseDateOnlyToUtcMidnight(startKey);
  const endDate = parseDateOnlyToUtcMidnight(endKey);

  const lineType = mode === "cash" ? "PAYMENT" : "CHARGE";

  const rows = await prisma.folioLine.groupBy({
    by: ["date"],
    where: {
      propertyId: property.id,
      type: lineType,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amountCents: true },
    orderBy: { date: "asc" },
  });

  const normalizedRows = rows.map((r) => {
    const raw = r._sum.amountCents ?? 0;
    // Ledger stores PAYMENTS as negative amounts.
    const amountCents = mode === "cash" ? -raw : raw;
    return { date: r.date, amountCents };
  });

  const totalCents = normalizedRows.reduce((acc, r) => acc + r.amountCents, 0);

  function fmtDate(d: Date) {
    return formatDateOnlyFromDate(d, dateFormat);
  }

  return (
    <main className="space-y-6">
      <PageHeader title="Reports" subtitle={property.name} />

      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-sm">Range</label>
              <select
                name="preset"
                defaultValue={preset}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="thisMonth">This month</option>
                <option value="lastMonth">Last month</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm">Start</label>
              <input
                name="start"
                type="date"
                defaultValue={startKey}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm">End</label>
              <input
                name="end"
                type="date"
                defaultValue={endKey}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm">Mode</label>
              <select
                name="mode"
                defaultValue={mode}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="cash">Cash basis (income received)</option>
                <option value="accrual">Accrual basis (revenue earned)</option>
              </select>
            </div>

            <Button variant="secondary" type="submit">
              Apply
            </Button>
          </form>

          <div className="mt-3 text-xs text-muted-foreground">
            Showing {fmtDate(startDate)} → {fmtDate(endDate)}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(totalCents, property.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Mode</div>
            <div className="mt-1 text-2xl font-semibold">
              {mode === "cash" ? "Cash" : "Accrual"}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-semibold">By day</div>
          {normalizedRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data for this range.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {normalizedRows.map((r) => (
                  <tr key={r.date.toISOString()} className="border-b border-border last:border-b-0">
                    <td className="py-2">{fmtDate(r.date)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {formatMoney(r.amountCents, property.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <td className="py-2 font-semibold">TOTAL</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap">
                    {formatMoney(totalCents, property.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
