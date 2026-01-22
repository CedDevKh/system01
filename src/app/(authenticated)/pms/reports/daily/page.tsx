import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { parseDateOnlyToUtcMidnight, formatUtcDateOnly } from "@/lib/pms/dates";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

function getUtcDayRange(dateOnly: string) {
  const start = parseDateOnlyToUtcMidnight(dateOnly);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function parsePaymentMethod(description: string | null) {
  if (!description) return "OTHER";
  const match = description.match(/^Payment \(([^)]+)\)/i);
  if (!match) return "OTHER";
  const raw = match[1].trim().toUpperCase();
  if (raw === "CASH") return "CASH";
  if (raw === "CARD") return "CARD";
  if (raw === "BANK_TRANSFER") return "BANK_TRANSFER";
  if (raw === "ONLINE") return "ONLINE";
  if (raw === "OTHER") return "OTHER";
  return "OTHER";
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();
  const dateFormat = await getCurrentUserDateFormat();
  if (!canManageStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Daily report" />
        <p className="text-sm text-black/70">Not authorized.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const dateParam = typeof sp.date === "string" ? sp.date : "";
  const today = formatUtcDateOnly(new Date());
  const dateOnly = dateParam || today;

  let range: { start: Date; end: Date };
  try {
    range = getUtcDayRange(dateOnly);
  } catch {
    range = getUtcDayRange(today);
  }

  const { start: dayStart, end: dayEnd } = range;

  const [arrivals, departures, inHouse, paymentLines] = await Promise.all([
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        startDate: { gte: dayStart, lt: dayEnd },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] },
        },
      },
      orderBy: [{ startDate: "asc" }],
      take: 200,
      select: {
        reservationId: true,
        startDate: true,
        endDate: true,
        room: { select: { name: true, roomType: { select: { code: true } } } },
        reservation: {
          select: {
            status: true,
            guestName: true,
          },
        },
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        endDate: { gte: dayStart, lt: dayEnd },
        reservation: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        },
      },
      orderBy: [{ endDate: "asc" }],
      take: 200,
      select: {
        reservationId: true,
        startDate: true,
        endDate: true,
        room: { select: { name: true, roomType: { select: { code: true } } } },
        reservation: {
          select: {
            status: true,
            guestName: true,
          },
        },
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        startDate: { lte: dayStart },
        endDate: { gt: dayStart },
        reservation: { status: "CHECKED_IN" },
      },
      orderBy: [{ startDate: "asc" }],
      take: 200,
      select: {
        reservationId: true,
        endDate: true,
        room: { select: { name: true, roomType: { select: { code: true } } } },
        reservation: {
          select: {
            status: true,
            guestName: true,
          },
        },
      },
    }),
    prisma.folioLine.findMany({
      where: {
        propertyId: property.id,
        type: "PAYMENT",
        postedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: [{ postedAt: "asc" }],
      take: 500,
      select: {
        amountCents: true,
        description: true,
      },
    }),
  ]);

  const currency = property.currency;

  const paymentsByMethod = new Map<
    "CASH" | "CARD" | "BANK_TRANSFER" | "ONLINE" | "OTHER",
    number
  >([
    ["CASH", 0],
    ["CARD", 0],
    ["BANK_TRANSFER", 0],
    ["ONLINE", 0],
    ["OTHER", 0],
  ]);

  let paymentsTotalCents = 0;
  for (const p of paymentLines) {
    paymentsTotalCents += p.amountCents;
    const method = parsePaymentMethod(p.description);
    paymentsByMethod.set(method, (paymentsByMethod.get(method) ?? 0) + p.amountCents);
  }

  const paymentsRows = Array.from(paymentsByMethod.entries()).filter(([, v]) => v !== 0);

  function fmtDate(d: Date) {
    return formatDateOnlyFromDate(d, dateFormat);
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Daily report"
        subtitle={property.name}
        actions={
          <Button variant="ghost" href="/pms/stays">
            ← Stays
          </Button>
        }
      />

      <Card>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-sm">Date</label>
              <input
                name="date"
                type="date"
                className="border px-2 py-1"
                defaultValue={dateOnly}
              />
            </div>
            <Button variant="secondary" type="submit">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">Arrivals</div>
            <div className="mt-1 text-2xl font-semibold">{arrivals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">Departures</div>
            <div className="mt-1 text-2xl font-semibold">{departures.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">In-house</div>
            <div className="mt-1 text-2xl font-semibold">{inHouse.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">Total payments</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(paymentsTotalCents, currency)}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">Payments by method</div>
        {paymentsTotalCents === 0 ? (
          <div className="text-sm text-black/70">No payments for this date.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Method</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentsRows.map(([method, amount]) => (
                <tr key={method} className="border-b last:border-b-0">
                  <td className="py-2">{method}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {formatMoney(amount, currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="py-2 font-semibold">TOTAL</td>
                <td className="py-2 text-right font-semibold whitespace-nowrap">
                  {formatMoney(paymentsTotalCents, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Arrivals</h2>
        <Card>
          <CardContent className="p-0">
          {arrivals.length === 0 ? (
            <div className="p-4 text-sm text-black/70">No arrivals for this date.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3">Guest</th>
                  <th className="py-2 px-3">Room</th>
                  <th className="py-2 px-3">Check-in</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((a) => (
                  <tr key={a.reservationId} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium">{a.reservation.guestName}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {a.room?.name ? `${a.room.name} (${a.room.roomType.code})` : "Unassigned"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">{fmtDate(a.startDate)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{a.reservation.status}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Button href={`/pms/stays/${a.reservationId}`} variant="ghost" className="px-2 py-1">
                        View stay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Departures</h2>
        <Card>
          <CardContent className="p-0">
          {departures.length === 0 ? (
            <div className="p-4 text-sm text-black/70">No departures for this date.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3">Guest</th>
                  <th className="py-2 px-3">Room</th>
                  <th className="py-2 px-3">Check-out</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {departures.map((d) => (
                  <tr key={d.reservationId} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium">{d.reservation.guestName}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {d.room?.name ? `${d.room.name} (${d.room.roomType.code})` : "Unassigned"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">{fmtDate(d.endDate)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{d.reservation.status}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Button href={`/pms/stays/${d.reservationId}`} variant="ghost" className="px-2 py-1">
                        View stay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">In-house</h2>
        <Card>
          <CardContent className="p-0">
          {inHouse.length === 0 ? (
            <div className="p-4 text-sm text-black/70">No in-house stays for this date.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3">Room</th>
                  <th className="py-2 px-3">Guest</th>
                  <th className="py-2 px-3">Check-out</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {inHouse.map((s) => (
                  <tr key={s.reservationId} className="border-b last:border-b-0">
                    <td className="py-2 px-3 whitespace-nowrap">
                      {s.room?.name ? `${s.room.name} (${s.room.roomType.code})` : "Unassigned"}
                    </td>
                    <td className="py-2 px-3 font-medium">{s.reservation.guestName}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{fmtDate(s.endDate)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{s.reservation.status}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Button href={`/pms/stays/${s.reservationId}`} variant="ghost" className="px-2 py-1">
                        View stay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
