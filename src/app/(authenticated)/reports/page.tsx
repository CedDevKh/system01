import { formatMoney } from "@/lib/money";
import { formatUtcDateOnly, parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  getDailyReport,
  normalizeRangeOrToday,
  parseMode,
  parsePreset,
  resolveRange,
  type ReportMode,
  type ReportPreset,
} from "@/lib/reports/daily";

export const dynamic = "force-dynamic";

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

  const resolved = resolveRange({
    today,
    preset,
    start: customStart,
    end: customEnd,
  });

  const { startKey, endKey } = normalizeRangeOrToday({
    today,
    startKey: resolved.startKey,
    endKey: resolved.endKey,
  });

  const report = await getDailyReport({
    propertyId: property.id,
    mode,
    startKey,
    endKey,
  });

  const startDate = parseDateOnlyToUtcMidnight(startKey);
  const endDateInclusive = parseDateOnlyToUtcMidnight(endKey);

  function fmtDate(d: Date) {
    return formatDateOnlyFromDate(d, dateFormat);
  }

  const exportHref = `/api/reports/export?preset=${encodeURIComponent(preset)}&start=${encodeURIComponent(
    startKey,
  )}&end=${encodeURIComponent(endKey)}&mode=${encodeURIComponent(mode)}`;

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

            <Button variant="secondary" href={exportHref}>
              Export CSV
            </Button>
          </form>

          <div className="mt-3 text-xs text-muted-foreground">
            Showing {fmtDate(startDate)} → {fmtDate(endDateInclusive)}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold">
              {report.mode === "cash"
                ? formatMoney(report.totalNetCashCents, property.currency)
                : formatMoney(report.totalChargesCents, property.currency)}
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
          {report.rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data for this range.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2">Date</th>
                  {report.mode === "cash" ? (
                    <>
                      <th className="py-2 text-right">Cash in</th>
                      <th className="py-2 text-right">Refunds</th>
                      <th className="py-2 text-right">Net cash</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 text-right">Room</th>
                      <th className="py-2 text-right">Fee</th>
                      <th className="py-2 text-right">Tax</th>
                      <th className="py-2 text-right">Discount</th>
                      <th className="py-2 text-right">Adjustment</th>
                      <th className="py-2 text-right">Uncategorized</th>
                      <th className="py-2 text-right">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.mode === "cash"
                  ? report.rows.map((r) => {
                      const d = parseDateOnlyToUtcMidnight(r.dateKey);
                      return (
                        <tr key={r.dateKey} className="border-b border-border last:border-b-0">
                          <td className="py-2">{fmtDate(d)}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.cashInCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.refundsCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.netCashCents, property.currency)}
                          </td>
                        </tr>
                      );
                    })
                  : report.rows.map((r) => {
                      const d = parseDateOnlyToUtcMidnight(r.dateKey);
                      return (
                        <tr key={r.dateKey} className="border-b border-border last:border-b-0">
                          <td className="py-2">{fmtDate(d)}</td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.roomCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.feeCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.taxCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.discountCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.adjustmentCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.uncategorizedCents, property.currency)}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {formatMoney(r.totalCents, property.currency)}
                          </td>
                        </tr>
                      );
                    })}
                <tr className="border-t border-border">
                  <td className="py-2 font-semibold">TOTAL</td>
                  {report.mode === "cash" ? (
                    <>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">
                        {formatMoney(report.totalNetCashCents, property.currency)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap"></td>
                      <td className="py-2 text-right font-semibold whitespace-nowrap">
                        {formatMoney(report.totalChargesCents, property.currency)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
