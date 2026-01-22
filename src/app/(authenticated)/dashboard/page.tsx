import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getActivePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

function getTodayUtcRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

function guestLabel(row: { reservation: { guestName: string } }) {
  return row.reservation.guestName;
}

export default async function DashboardPage() {
  const { property } = await getActivePropertyContext();
  const { start: todayStart, end: todayEnd } = getTodayUtcRange();

  const [totalRooms, arrivals, departures, inHouse] = await Promise.all([
    prisma.room.count({
      where: {
        propertyId: property.id,
        isActive: true,
        status: "ACTIVE",
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        startDate: { gte: todayStart, lt: todayEnd },
        reservation: {
          status: {
            in: ["HOLD", "CONFIRMED"],
          },
        },
      },
      orderBy: [{ startDate: "asc" }],
      take: 50,
      select: {
        reservationId: true,
        roomId: true,
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
        endDate: { gte: todayStart, lt: todayEnd },
        reservation: {
          status: {
            in: ["CONFIRMED", "CHECKED_IN"],
          },
        },
      },
      orderBy: [{ endDate: "asc" }],
      take: 50,
      select: {
        reservationId: true,
        roomId: true,
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
        startDate: { lte: todayEnd },
        endDate: { gt: todayStart },
        reservation: { status: "CHECKED_IN" },
      },
      orderBy: [{ startDate: "asc" }],
      take: 50,
      select: {
        reservationId: true,
        roomId: true,
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
  ]);

  const occupiedRooms = new Set(inHouse.map((s) => s.roomId)).size;
  const occupancyPercent =
    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : null;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={property.name}
        actions={<Button variant="primary" href="/pms/stays/new">New reservation</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">Arrivals today</div>
            <div className="mt-1 text-2xl font-semibold">{arrivals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-black/70">Departures today</div>
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
            <div className="text-sm text-black/70">Occupancy</div>
            <div className="mt-1 text-2xl font-semibold">
              {totalRooms === 0
                ? "N/A"
                : `${occupiedRooms}/${totalRooms} (${occupancyPercent ?? 0}%)`}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-black/10 bg-white p-4">
          <div className="text-sm font-semibold">Arrivals today</div>
          {arrivals.length === 0 ? (
            <div className="mt-2 text-sm text-black/70">No arrivals today.</div>
          ) : (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Guest</th>
                  <th className="py-2">Room</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Check-in</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((a) => (
                  <tr key={a.reservationId} className="border-b">
                    <td className="py-2 font-medium">{guestLabel(a)}</td>
                    <td className="py-2 whitespace-nowrap">
                      {a.room?.name ? (
                        <span>
                          {a.room.name} ({a.room.roomType.code})
                        </span>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">{a.reservation.status}</td>
                    <td className="py-2 whitespace-nowrap">{formatDateTime(a.startDate)}</td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <Link className="underline" href={`/pms/stays/${a.reservationId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-4">
          <div className="text-sm font-semibold">Departures today</div>
          {departures.length === 0 ? (
            <div className="mt-2 text-sm text-black/70">No departures today.</div>
          ) : (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Guest</th>
                  <th className="py-2">Room</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Check-out</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {departures.map((d) => (
                  <tr key={d.reservationId} className="border-b">
                    <td className="py-2 font-medium">{guestLabel(d)}</td>
                    <td className="py-2 whitespace-nowrap">
                      {d.room?.name ? (
                        <span>
                          {d.room.name} ({d.room.roomType.code})
                        </span>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">{d.reservation.status}</td>
                    <td className="py-2 whitespace-nowrap">{formatDateTime(d.endDate)}</td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <Link className="underline" href={`/pms/stays/${d.reservationId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-4">
          <div className="text-sm font-semibold">In-house</div>
          {inHouse.length === 0 ? (
            <div className="mt-2 text-sm text-black/70">No in-house stays.</div>
          ) : (
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Room</th>
                  <th className="py-2">Guest</th>
                  <th className="py-2">Check-out</th>
                  <th className="py-2">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {inHouse.map((s) => (
                  <tr key={s.reservationId} className="border-b">
                    <td className="py-2 whitespace-nowrap">
                      {s.room?.name ? (
                        <span>
                          {s.room.name} ({s.room.roomType.code})
                        </span>
                      ) : (
                        "Unassigned"
                      )}
                    </td>
                    <td className="py-2 font-medium">{guestLabel(s)}</td>
                    <td className="py-2 whitespace-nowrap">{formatDate(s.endDate)}</td>
                    <td className="py-2 whitespace-nowrap">{s.reservation.status}</td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <Link className="underline" href={`/pms/stays/${s.reservationId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
