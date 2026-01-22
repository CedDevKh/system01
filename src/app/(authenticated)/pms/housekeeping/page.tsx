import { prisma } from "@/lib/prisma";
import {
  canManageStays,
  canViewStays,
  getActivePropertyContext,
} from "@/lib/propertyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import { updateHousekeepingStatus } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

function getTodayUtcRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export default async function HousekeepingPage() {
  const { property, membership } = await getActivePropertyContext();
  if (!canViewStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Housekeeping" />
        <p className="text-sm text-black/70">No access.</p>
      </main>
    );
  }

  const canEdit = canManageStays(membership);
  const { start: todayStart, end: todayEnd } = getTodayUtcRange();

  const [rooms, stays] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: property.id },
      include: {
        roomType: { select: { code: true, name: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        startDate: { lt: todayEnd },
        endDate: { gt: todayStart },
        reservation: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      },
      select: {
        roomId: true,
        endDate: true,
        reservation: {
          select: {
            status: true,
            guestName: true,
          },
        },
      },
    }),
  ]);

  const stayByRoomId = new Map(
    stays.map((s) => {
      const guest = s.reservation.guestName;
      return [
        s.roomId,
        {
          status: s.reservation.status,
          guest,
          checkOut: s.endDate,
        },
      ] as const;
    }),
  );

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Housekeeping"
        subtitle={property.name}
      />

      <div className="text-sm text-black/70">Statuses: CLEAN, DIRTY, INSPECT, OUT_OF_SERVICE</div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-3">Room</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">HK status</th>
              <th className="py-2 px-3">Occupancy</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => {
              const stay = stayByRoomId.get(r.id) ?? null;
              return (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="font-medium">{r.name}</div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-sm text-black/70">
                    {r.roomType.code} — {r.roomType.name}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <Badge variant="neutral">{r.housekeepingStatus}</Badge>
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {stay ? (
                      <div>
                        <div className="font-medium">{stay.guest}</div>
                        <div className="text-xs text-black/60">
                          {stay.status} · Check-out {formatDate(stay.checkOut)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-black/60">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-right">
                    {canEdit ? (
                      <form action={updateHousekeepingStatus} className="inline-flex items-center gap-2">
                        <input type="hidden" name="roomId" value={r.id} />
                        <select
                          name="status"
                          className="border px-2 py-1 text-sm"
                          defaultValue={r.housekeepingStatus}
                        >
                          <option value="CLEAN">CLEAN</option>
                          <option value="DIRTY">DIRTY</option>
                          <option value="INSPECT">INSPECT</option>
                          <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                        </select>
                        <Button variant="secondary" type="submit" className="px-3 py-1 text-sm">
                          Update
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
