import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import {
  enumerateDateOnly,
  formatUtcDateOnly,
  parseDateOnlyToUtcMidnight,
} from "@/lib/pms/dates";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

import { AvailabilityCalendarPage } from "./components/AvailabilityCalendarPage";
import type { AvailabilityResponse, ViewDays } from "./components/types";

export const dynamic = "force-dynamic";

function clampViewDays(v: number): ViewDays {
  if (v <= 7) return 7;
  if (v <= 14) return 14;
  return 30;
}

function diffDays(fromDateOnly: string, toDateOnly: string): number {
  const from = parseDateOnlyToUtcMidnight(fromDateOnly);
  const to = parseDateOnlyToUtcMidnight(toDateOnly);
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function initialLoadDays(viewDays: ViewDays): number {
  return Math.max(60, viewDays * 2);
}

function toDateKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Include some past days so users can scroll left to see history
const PAST_DAYS_BUFFER = 14;

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activePropertyId, role, user } = await requireActivePropertyScope();
  const canManageReservations = role === "OWNER" || role === "MANAGER";

  const sp = await searchParams;
  const fromParam = typeof sp.from === "string" ? sp.from : undefined;
  const toParam = typeof sp.to === "string" ? sp.to : undefined;
  const viewParam = typeof sp.view === "string" ? sp.view : undefined;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const fromStr = fromParam ?? todayStr;
  const toStr = toParam ?? "";

  const viewDaysFromParam = viewParam ? Number(viewParam) : NaN;
  const viewDays: ViewDays = Number.isFinite(viewDaysFromParam)
    ? clampViewDays(viewDaysFromParam)
    : toParam
      ? clampViewDays(diffDays(fromStr, toStr))
      : 14;

  // Include past days so user can scroll left
  const from = (() => {
    const d = parseDateOnlyToUtcMidnight(fromStr);
    d.setUTCDate(d.getUTCDate() - PAST_DAYS_BUFFER);
    return d;
  })();
  const to = (() => {
    const d = parseDateOnlyToUtcMidnight(fromStr);
    d.setUTCDate(d.getUTCDate() + initialLoadDays(viewDays));
    return d;
  })();

  const dates = enumerateDateOnly(from, to);
  // Index of "today" or the requested start date within the dates array
  const initialScrollIndex = PAST_DAYS_BUFFER;
  const dateFormat = await getCurrentUserDateFormat();

  const [property, properties, rooms, blocks, stays] = await Promise.all([
    prisma.property.findFirst({ where: { id: activePropertyId }, select: { id: true, name: true } }),
    prisma.propertyUser.findMany({
      where: { userId: user.id },
      select: { property: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.room.findMany({
      where: { propertyId: activePropertyId, isActive: true },
      orderBy: [{ roomType: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        housekeepingStatus: true,
        roomType: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.block.findMany({
      where: {
        propertyId: activePropertyId,
        startDate: { lt: to },
        endDate: { gt: from },
      },
      select: { id: true, roomId: true, startDate: true, endDate: true, reason: true },
      orderBy: [{ startDate: "asc" }],
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: activePropertyId,
        startDate: { lt: to },
        endDate: { gt: from },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        },
      },
      select: {
        reservationId: true,
        roomId: true,
        startDate: true,
        endDate: true,
        reservation: { select: { status: true, guestName: true, source: true, channel: true } },
      },
      orderBy: [{ startDate: "asc" }],
    }),
  ]);

  const blocksByRoom = new Map<string, Array<{ id: string; roomId: string; startDate: string; endDate: string; reason: string | null }>>();
  for (const b of blocks) {
    const list = blocksByRoom.get(b.roomId) ?? [];
    list.push({
      id: b.id,
      roomId: b.roomId,
      startDate: formatUtcDateOnly(b.startDate),
      endDate: formatUtcDateOnly(b.endDate),
      reason: b.reason ?? null,
    });
    blocksByRoom.set(b.roomId, list);
  }

  const staysByRoom = new Map<
    string,
    Array<{
      id: string;
      roomId: string;
      startDate: string;
      endDate: string;
      startDateKey: string;
      endDateKey: string;
      status: "DRAFT" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT";
      guestName: string;
      source: "MANUAL" | "DIRECT";
      channel: string | null;
    }>
  >();

  for (const s of stays) {
    const list = staysByRoom.get(s.roomId) ?? [];
    const publicStatus = s.reservation.status === "HOLD" ? "DRAFT" : (s.reservation.status as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT");
    const startDateKey = toDateKeyUTC(s.startDate);
    const endDateKey = toDateKeyUTC(s.endDate);
    list.push({
      id: s.reservationId,
      roomId: s.roomId,
      startDate: formatUtcDateOnly(s.startDate),
      endDate: formatUtcDateOnly(s.endDate),
      startDateKey,
      endDateKey,
      status: publicStatus,
      guestName: s.reservation.guestName,
      source: s.reservation.source,
      channel: s.reservation.channel ?? null,
    });
    staysByRoom.set(s.roomId, list);
  }

  const initial: AvailabilityResponse = {
    from: formatUtcDateOnly(from),
    to: formatUtcDateOnly(to),
    dates,
    rooms: rooms.map((r) => {
      const staysForRoom = staysByRoom.get(r.id) ?? [];
      const blocksForRoom = blocksByRoom.get(r.id) ?? [];
      const occupancy = dates.map((dayKey): "" | "STAY" | "BLOCK" => {
        for (const s of staysForRoom) {
          // Stays are night-based: checkout date is exclusive.
          // Comparisons are key-based (YYYY-MM-DD) to avoid timezone shifts.
          if (s.startDateKey <= dayKey && dayKey < s.endDateKey) return "STAY";
        }
        for (const b of blocksForRoom) {
          if (b.startDate <= dayKey && dayKey < b.endDate) return "BLOCK";
        }
        return "";
      });

      return {
        id: r.id,
        name: r.name,
        status: r.status,
        housekeepingStatus: r.housekeepingStatus,
        roomType: r.roomType,
        stays: staysForRoom,
        blocks: blocksForRoom,
        occupancy,
      };
    }),
  };

  const availableProperties = properties.map((p) => p.property);

  return (
    <main className="p-4 space-y-4 h-full flex flex-col min-w-0">
      <PageHeader
        title="Availability"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" href="/pms/rooms">
              ← Rooms
            </Button>
            <Button variant="ghost" href="/pms/stays">
              Stays →
            </Button>
          </div>
        }
      />

      <div className="flex-1 min-h-0 min-w-0">
        <AvailabilityCalendarPage
          initial={initial}
          initialFrom={fromStr}
          initialViewDays={viewDays}
          initialScrollIndex={initialScrollIndex}
          dateFormat={dateFormat}
          currentProperty={{ id: property?.id ?? activePropertyId, name: property?.name ?? "Property" }}
          availableProperties={availableProperties}
          canManageReservations={canManageReservations}
        />
      </div>
    </main>
  );
}
