import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import {
  canManageStays,
  canViewStays,
  getActivePropertyContext,
} from "@/lib/propertyContext";

import { updateGuestNotes } from "../actions";

export const dynamic = "force-dynamic";

export default async function GuestProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { property, membership } = await getActivePropertyContext();
  const dateFormat = await getCurrentUserDateFormat();
  if (!canViewStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Guest" />
        <p className="text-sm text-black/70">No access.</p>
      </main>
    );
  }

  const canEditNotes = canManageStays(membership);
  const { id } = await params;

  const guest = await prisma.guest.findFirst({
    where: { id, propertyId: property.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!guest) {
    return (
      <main className="p-6">
        <PageHeader
          title="Guest not found"
          actions={
            <Button href="/pms/guests" variant="ghost">
              ← Guests
            </Button>
          }
        />
      </main>
    );
  }

  const stays = await prisma.reservationStay.findMany({
    where: {
      propertyId: property.id,
      reservation: { bookerGuestId: guest.id },
    },
    orderBy: [{ startDate: "desc" }],
    take: 50,
    select: {
      reservationId: true,
      startDate: true,
      endDate: true,
      room: { select: { name: true } },
      roomType: { select: { code: true, name: true } },
      reservation: {
        select: {
          status: true,
          paymentStatus: true,
          channel: true,
        },
      },
    },
  });

  const fullName = `${guest.firstName} ${guest.lastName}`.trim() || "Guest";

  return (
    <main className="p-6">
      <PageHeader
        title={fullName}
        subtitle={property.name}
        actions={
          <Button href="/pms/guests" variant="ghost">
            ← Guests
          </Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Guest info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-sm font-medium">{guest.email ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="text-sm font-medium">{guest.phone ?? "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent>
            {canEditNotes ? (
              <form action={updateGuestNotes} className="space-y-2">
                <input type="hidden" name="guestId" value={guest.id} />
                <textarea
                  name="internalNotes"
                  className="w-full border px-2 py-1"
                  rows={4}
                  defaultValue={guest.notes ?? ""}
                  placeholder="Optional"
                />
                <Button type="submit">Save notes</Button>
              </form>
            ) : (
              <div className="text-sm text-black/70 whitespace-pre-wrap">
                {guest.notes ? guest.notes : "No notes."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stay history</CardTitle>
          </CardHeader>
          <CardContent>
            {stays.length === 0 ? (
              <div className="text-sm text-black/70">No stays yet.</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Check-in</th>
                    <th className="py-2">Check-out</th>
                    <th className="py-2">Room</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Payment</th>
                    <th className="py-2">Channel</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {stays.map((s) => (
                    <tr
                      key={`${s.reservationId}:${s.startDate.toISOString()}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-2 whitespace-nowrap">{formatDateOnlyFromDate(s.startDate, dateFormat)}</td>
                      <td className="py-2 whitespace-nowrap">{formatDateOnlyFromDate(s.endDate, dateFormat)}</td>
                      <td className="py-2 whitespace-nowrap">
                        {s.room.name} ({s.roomType.code})
                      </td>
                      <td className="py-2 whitespace-nowrap">{s.reservation.status}</td>
                      <td className="py-2 whitespace-nowrap">{s.reservation.paymentStatus ?? "—"}</td>
                      <td className="py-2 whitespace-nowrap">{s.reservation.channel ?? ""}</td>
                      <td className="py-2 text-right whitespace-nowrap">
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
      </div>
    </main>
  );
}
