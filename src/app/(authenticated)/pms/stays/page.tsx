import Link from "next/link";

import { prisma } from "@/lib/prisma";
import {
  canManageStays,
  canViewStays,
  getActivePropertyContext,
} from "@/lib/propertyContext";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import { createStay } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();
  if (!canViewStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Stays" />
        <p className="text-sm text-black/70">No access.</p>
      </main>
    );
  }

  const dateFormat = await getCurrentUserDateFormat();

  const canCreate = canManageStays(membership);

  const sp = await searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const futureParam = typeof sp.future === "string" ? sp.future : "";
  const errorParam = typeof sp.error === "string" ? sp.error : "";

  const allowedStatuses = [
    "HOLD",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "CANCELLED",
    "NO_SHOW",
  ] as const;

  const statusFilter = (allowedStatuses as readonly string[]).includes(statusParam)
    ? (statusParam as (typeof allowedStatuses)[number])
    : null;

  const futureOnly = futureParam === "1";
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const [rooms, stays] = await Promise.all([
    prisma.room.findMany({
      where: {
        propertyId: property.id,
        isActive: true,
        status: "ACTIVE",
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        roomType: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.reservation.findMany({
      where: {
        propertyId: property.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(futureOnly
          ? {
              stays: {
                some: {
                  endDate: { gt: todayUtc },
                },
              },
            }
          : {}),
      },
      include: {
        stays: {
          take: 1,
          include: {
            room: { include: { roomType: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
  ]);

  type RoomRow = (typeof rooms)[number];
  type StayRow = (typeof stays)[number];

  const defaultCheckIn = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultCheckOut = tomorrow.toISOString().slice(0, 10);

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Stays"
        subtitle={property.name}
        actions={
          <div className="flex items-center gap-2">
            {canCreate ? (
              <Button variant="primary" href="/pms/stays/new">
                New reservation
              </Button>
            ) : null}
            <Button variant="ghost" href="/pms/availability">
              ← Availability
            </Button>
          </div>
        }
      />

      {errorParam ? (
        <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
          {errorParam}
        </div>
      ) : null}

      <Card>
        <CardContent>
          <form className="flex flex-wrap gap-2 items-end" method="get">
            <div className="flex flex-col">
              <label className="text-sm">Status</label>
              <select
                name="status"
                className="border px-2 py-1"
                defaultValue={statusFilter ?? ""}
              >
                <option value="">All</option>
                {allowedStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm">Dates</label>
              <select
                name="future"
                className="border px-2 py-1"
                defaultValue={futureOnly ? "1" : "0"}
              >
                <option value="1">Future only</option>
                <option value="0">All</option>
              </select>
            </div>

            <Button variant="secondary" type="submit">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Create stay</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createStay} className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">Room</label>
                <select name="roomId" className="border px-2 py-1" required>
                  <option value="">Select…</option>
                  {rooms.map((r: RoomRow) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.roomType.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm">Guest name</label>
                <input name="guestName" className="border px-2 py-1" required />
              </div>

              <div className="flex flex-col">
                <label className="text-sm">Guest email</label>
                <input name="guestEmail" className="border px-2 py-1" placeholder="optional" />
              </div>

              <div className="flex flex-col">
                <label className="text-sm">Check-in</label>
                <input
                  name="checkInDate"
                  type="date"
                  className="border px-2 py-1"
                  defaultValue={defaultCheckIn}
                  required
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm">Check-out</label>
                <input
                  name="checkOutDate"
                  type="date"
                  className="border px-2 py-1"
                  defaultValue={defaultCheckOut}
                  required
                />
              </div>

              <Button variant="secondary" type="submit">
                Create
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Check-in</th>
            <th className="py-2">Check-out</th>
            <th className="py-2">Guest</th>
            <th className="py-2">Room</th>
            <th className="py-2">Status</th>
            <th className="py-2">Payment</th>
            <th className="py-2">Channel</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {stays.map((s: StayRow) => {
            const stayRow = s.stays[0];
            const start = stayRow?.startDate
              ? formatDateOnlyFromDate(stayRow.startDate, dateFormat)
              : "";
            const end = stayRow?.endDate
              ? formatDateOnlyFromDate(stayRow.endDate, dateFormat)
              : "";
            const status = s.status === "HOLD" ? "DRAFT" : s.status;
            const guestName = s.guestName;
            const roomLabel = stayRow?.room
              ? `${stayRow.room.name} (${stayRow.room.roomType.code})`
              : "—";
            return (
              <tr key={s.id} className="border-b">
                <td className="py-2 whitespace-nowrap">{start || "—"}</td>
                <td className="py-2 whitespace-nowrap">{end || "—"}</td>
                <td className="py-2">
                  <div className="font-medium">{guestName}</div>
                  {s.guestEmail ? (
                    <div className="text-sm text-black/70">{s.guestEmail}</div>
                  ) : null}
                </td>
                <td className="py-2 whitespace-nowrap">{roomLabel}</td>
                <td className="py-2 whitespace-nowrap">{status}</td>
                <td className="py-2 whitespace-nowrap">{s.paymentStatus ?? "—"}</td>
                <td className="py-2 whitespace-nowrap">{s.channel ?? ""}</td>
                <td className="py-2 whitespace-nowrap">
                  <Button href={`/pms/stays/${s.id}`} variant="ghost" className="px-2 py-1">
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
