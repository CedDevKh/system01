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
import { NewStayButton } from "./components/NewStayButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

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

  const pillBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  function statusPillClass(status: string) {
    if (status === "CONFIRMED") return `${pillBase} bg-blue-100 text-blue-700`;
    if (status === "CHECKED_IN") return `${pillBase} bg-green-100 text-green-700`;
    if (status === "CHECKED_OUT") return `${pillBase} bg-slate-100 text-slate-700`;
    if (status === "CANCELLED") return `${pillBase} bg-red-100 text-red-700`;
    return `${pillBase} bg-slate-100 text-slate-700`;
  }

  function paymentPillClass(payment: string) {
    if (payment === "PAID") return `${pillBase} bg-green-100 text-green-700`;
    if (payment === "PARTIAL") return `${pillBase} bg-amber-100 text-amber-800`;
    if (payment === "UNPAID") return `${pillBase} bg-red-100 text-red-700`;
    return `${pillBase} bg-slate-100 text-slate-700`;
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Stays"
        subtitle="Manage reservations and in-house guests."
        actions={
          <div className="flex items-center gap-2">
            {canCreate ? (
              <NewStayButton />
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
            <form action={createStay} className="max-w-3xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Room</label>
                  <select
                    name="roomId"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Select…</option>
                    {rooms.map((r: RoomRow) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.roomType.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Guest name</label>
                  <input
                    id="create-stay"
                    name="guestName"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Guest email</label>
                <input
                  name="guestEmail"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="optional"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Check-in</label>
                  <input
                    name="checkInDate"
                    type="date"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={defaultCheckIn}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Check-out</label>
                  <input
                    name="checkOutDate"
                    type="date"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={defaultCheckOut}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="primary" type="submit">
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="py-3 px-4">Check-in</th>
            <th className="py-3 px-4">Check-out</th>
            <th className="py-3 px-4">Guest</th>
            <th className="py-3 px-4">Room</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Payment</th>
            <th className="py-3 px-4">Channel</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
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
            const paymentStatus = (s.paymentStatus ?? "—") as string;
            return (
              <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                  {start || "—"}
                </td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                  {end || "—"}
                </td>
                <td className="py-3 px-4 text-sm align-middle">
                  <div className="font-medium text-foreground">{guestName}</div>
                  {s.guestEmail ? (
                    <div className="text-sm text-muted-foreground">{s.guestEmail}</div>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">{roomLabel}</td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                  <span className={statusPillClass(status)}>{status}</span>
                </td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                  {paymentStatus === "—" ? (
                    "—"
                  ) : (
                    <span className={paymentPillClass(paymentStatus)}>{paymentStatus}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                  {s.channel ?? ""}
                </td>
                <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
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
