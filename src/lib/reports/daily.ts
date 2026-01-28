import { prisma } from "@/lib/prisma";
import { formatUtcDateOnly, parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

export type ReportPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

export type ReportMode = "cash" | "accrual";

export type DailyCashRow = {
  dateKey: string; // YYYY-MM-DD
  cashInCents: number;
  refundsCents: number;
  netCashCents: number;
};

export type DailyAccrualRow = {
  dateKey: string; // YYYY-MM-DD
  roomCents: number;
  feeCents: number;
  taxCents: number;
  discountCents: number;
  adjustmentCents: number;
  uncategorizedCents: number;
  totalCents: number;
};

export type DailyReportResult =
  | {
      mode: "cash";
      startKey: string;
      endKey: string;
      rows: DailyCashRow[];
      totalNetCashCents: number;
    }
  | {
      mode: "accrual";
      startKey: string;
      endKey: string;
      rows: DailyAccrualRow[];
      totalChargesCents: number;
    };

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

export function parsePreset(input: unknown): ReportPreset {
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

export function parseMode(input: unknown): ReportMode {
  const s = typeof input === "string" ? input : "";
  return s === "cash" ? "cash" : "accrual";
}

export function resolveRange(params: {
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

export function normalizeRangeOrToday(params: {
  today: string;
  startKey: string;
  endKey: string;
}) {
  let { startKey, endKey } = params;
  try {
    const startDate = parseDateOnlyToUtcMidnight(startKey);
    const endDate = parseDateOnlyToUtcMidnight(endKey);
    if (endDate < startDate) {
      const tmp = startKey;
      startKey = endKey;
      endKey = tmp;
    }
  } catch {
    startKey = params.today;
    endKey = params.today;
  }
  return { startKey, endKey };
}

export function computeDateSeriesInclusive(startKey: string, endKey: string) {
  const start = parseDateOnlyToUtcMidnight(startKey);
  const end = parseDateOnlyToUtcMidnight(endKey);

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(formatUtcDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function toExclusiveEndDate(endKeyInclusive: string) {
  return parseDateOnlyToUtcMidnight(addUtcDays(endKeyInclusive, 1));
}

export async function getDailyReport(params: {
  propertyId: string;
  mode: ReportMode;
  startKey: string;
  endKey: string;
}): Promise<DailyReportResult> {
  const startDate = parseDateOnlyToUtcMidnight(params.startKey);
  const endExclusive = toExclusiveEndDate(params.endKey);
  const allDays = computeDateSeriesInclusive(params.startKey, params.endKey);

  if (params.mode === "cash") {
    // Cash basis:
    // - Cash in: sum(PAYMENT) for the day (ledger stores PAYMENT as negative)
    // - Refunds: sum(REFUND) for the day (assumed positive outflow)
    // - Net cash: cash in - refunds
    const grouped = await prisma.folioLine.groupBy({
      by: ["date", "type"],
      where: {
        propertyId: params.propertyId,
        type: { in: ["PAYMENT", "REFUND"] },
        date: { gte: startDate, lt: endExclusive },
      },
      _sum: { amountCents: true },
      orderBy: [{ date: "asc" }, { type: "asc" }],
    });

    const byDay = new Map<string, { paymentRaw: number; refundRaw: number }>();
    for (const row of grouped) {
      const key = formatUtcDateOnly(row.date);
      const raw = row._sum.amountCents ?? 0;
      const cur = byDay.get(key) ?? { paymentRaw: 0, refundRaw: 0 };
      if (row.type === "PAYMENT") cur.paymentRaw += raw;
      if (row.type === "REFUND") cur.refundRaw += raw;
      byDay.set(key, cur);
    }

    const rows: DailyCashRow[] = allDays.map((dateKey) => {
      const raw = byDay.get(dateKey) ?? { paymentRaw: 0, refundRaw: 0 };
      const cashInCents = -raw.paymentRaw;
      const refundsCents = raw.refundRaw;
      const netCashCents = cashInCents - refundsCents;
      return {
        dateKey,
        cashInCents,
        refundsCents,
        netCashCents,
      };
    });

    const totalNetCashCents = rows.reduce((acc, r) => acc + r.netCashCents, 0);

    return {
      mode: "cash",
      startKey: params.startKey,
      endKey: params.endKey,
      rows,
      totalNetCashCents,
    };
  }

  const grouped = await prisma.folioLine.groupBy({
    by: ["date", "chargeType"],
    where: {
      propertyId: params.propertyId,
      type: "CHARGE",
      date: { gte: startDate, lt: endExclusive },
    },
    _sum: { amountCents: true },
    orderBy: [{ date: "asc" }, { chargeType: "asc" }],
  });

  const byDay = new Map<string, Partial<Record<string, number>>>();
  for (const row of grouped) {
    const key = formatUtcDateOnly(row.date);
    const chargeType = row.chargeType ?? "UNCATEGORIZED";
    const raw = row._sum.amountCents ?? 0;
    const cur = byDay.get(key) ?? {};
    cur[chargeType] = (cur[chargeType] ?? 0) + raw;
    byDay.set(key, cur);
  }

  const rows: DailyAccrualRow[] = allDays.map((dateKey) => {
    const m = byDay.get(dateKey) ?? {};
    const roomCents = m.ROOM ?? 0;
    const feeCents = m.FEE ?? 0;
    const taxCents = m.TAX ?? 0;
    const discountCents = m.DISCOUNT ?? 0;
    const adjustmentCents = m.ADJUSTMENT ?? 0;
    const uncategorizedCents = (m.UNCATEGORIZED ?? 0) as number;
    const totalCents =
      roomCents +
      feeCents +
      taxCents +
      discountCents +
      adjustmentCents +
      uncategorizedCents;

    return {
      dateKey,
      roomCents,
      feeCents,
      taxCents,
      discountCents,
      adjustmentCents,
      uncategorizedCents,
      totalCents,
    };
  });

  const totalChargesCents = rows.reduce((acc, r) => acc + r.totalCents, 0);

  return {
    mode: "accrual",
    startKey: params.startKey,
    endKey: params.endKey,
    rows,
    totalChargesCents,
  };
}
