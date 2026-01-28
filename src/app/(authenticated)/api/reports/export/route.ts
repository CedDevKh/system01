import { NextResponse } from "next/server";

import { formatMoney } from "@/lib/money";
import {
  getDailyReport,
  normalizeRangeOrToday,
  parseMode,
  parsePreset,
  resolveRange,
} from "@/lib/reports/daily";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { formatUtcDateOnly } from "@/lib/pms/dates";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  if (/[\n\r",]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toCsv(lines: string[][]) {
  return lines.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n") + "\n";
}

export async function GET(req: Request) {
  const { property, membership } = await getActivePropertyContext();

  if (!canManageStays(membership)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;

  const preset = parsePreset(sp.get("preset"));
  const mode = parseMode(sp.get("mode"));

  const today = formatUtcDateOnly(new Date());
  const customStart = sp.get("start") ?? "";
  const customEnd = sp.get("end") ?? "";

  const resolved = resolveRange({
    today,
    preset,
    start: customStart,
    end: customEnd,
  });

  const normalized = normalizeRangeOrToday({
    today,
    startKey: resolved.startKey,
    endKey: resolved.endKey,
  });

  const report = await getDailyReport({
    propertyId: property.id,
    mode,
    startKey: normalized.startKey,
    endKey: normalized.endKey,
  });

  const currency = property.currency;

  let csv: string;
  if (report.mode === "cash") {
    const lines: string[][] = [
      [
        "date",
        "cashInCents",
        "refundsCents",
        "netCashCents",
        "cashIn",
        "refunds",
        "netCash",
      ],
      ...report.rows.map((r) => [
        r.dateKey,
        String(r.cashInCents),
        String(r.refundsCents),
        String(r.netCashCents),
        formatMoney(r.cashInCents, currency),
        formatMoney(r.refundsCents, currency),
        formatMoney(r.netCashCents, currency),
      ]),
      [
        "TOTAL",
        "",
        "",
        String(report.totalNetCashCents),
        "",
        "",
        formatMoney(report.totalNetCashCents, currency),
      ],
    ];
    csv = toCsv(lines);
  } else {
    const lines: string[][] = [
      [
        "date",
        "roomCents",
        "feeCents",
        "taxCents",
        "discountCents",
        "adjustmentCents",
        "uncategorizedCents",
        "totalCents",
        "room",
        "fee",
        "tax",
        "discount",
        "adjustment",
        "uncategorized",
        "total",
      ],
      ...report.rows.map((r) => [
        r.dateKey,
        String(r.roomCents),
        String(r.feeCents),
        String(r.taxCents),
        String(r.discountCents),
        String(r.adjustmentCents),
        String(r.uncategorizedCents),
        String(r.totalCents),
        formatMoney(r.roomCents, currency),
        formatMoney(r.feeCents, currency),
        formatMoney(r.taxCents, currency),
        formatMoney(r.discountCents, currency),
        formatMoney(r.adjustmentCents, currency),
        formatMoney(r.uncategorizedCents, currency),
        formatMoney(r.totalCents, currency),
      ]),
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        String(report.totalChargesCents),
        "",
        "",
        "",
        "",
        "",
        "",
        formatMoney(report.totalChargesCents, currency),
      ],
    ];
    csv = toCsv(lines);
  }

  const filename = `reports_${property.id}_${report.startKey}_to_${report.endKey}_${report.mode}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    },
  });
}
