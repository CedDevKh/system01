import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import {
  enumerateDateOnly,
  formatUtcDateOnly,
  parseDateOnlyToUtcMidnight,
} from "@/lib/pms/dates";

type Occupancy = "" | "STAY" | "BLOCK";

type ApiRoomType = { id: string; code: string; name: string };
type ApiBlock = {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

type ApiStayStatus = "DRAFT" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT";
type ApiStay = {
  id: string; // reservation id
  roomId: string;
  startDate: string;
  endDate: string;
  startDateKey: string; // YYYY-MM-DD
  endDateKey: string; // YYYY-MM-DD (checkout date, exclusive)
  status: ApiStayStatus;
  guestName: string;
  source: "MANUAL" | "DIRECT";
  channel: string | null;
};

function toDateKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  try {
    const { activePropertyId } = await requireActivePropertyScope();

    const url = new URL(req.url);
    const parsed = querySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });

    const from = parseDateOnlyToUtcMidnight(parsed.from);
    const to = parseDateOnlyToUtcMidnight(parsed.to);

    if (!(to > from)) {
      return NextResponse.json({ error: "to must be after from" }, { status: 400 });
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId: activePropertyId, isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        housekeepingStatus: true,
        roomType: { select: { id: true, code: true, name: true } },
      },
    });

    type RoomRow = (typeof rooms)[number];

    const blocks = await prisma.block.findMany({
      where: {
        propertyId: activePropertyId,
        startDate: { lt: to },
        endDate: { gt: from },
      },
      select: {
        id: true,
        roomId: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
      orderBy: [{ startDate: "asc" }],
    });

    const stays = await prisma.reservationStay.findMany({
      where: {
        propertyId: activePropertyId,
        startDate: { lt: to },
        endDate: { gt: from },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        },
      },
      select: {
        id: true,
        reservationId: true,
        roomId: true,
        startDate: true,
        endDate: true,
        reservation: {
          select: {
            status: true,
            guestName: true,
            source: true,
            channel: true,
          },
        },
      },
      orderBy: [{ startDate: "asc" }],
    });

    const blocksByRoom: Record<string, ApiBlock[]> = {};
    for (const b of blocks) {
      (blocksByRoom[b.roomId] ??= []).push({
        id: b.id,
        roomId: b.roomId,
        startDate: formatUtcDateOnly(b.startDate),
        endDate: formatUtcDateOnly(b.endDate),
        reason: b.reason ?? null,
      });
    }

    const staysByRoom: Record<string, ApiStay[]> = {};
    for (const s of stays) {
      const publicStatus: ApiStayStatus =
        s.reservation.status === "HOLD" ? "DRAFT" : (s.reservation.status as ApiStayStatus);
      const startKey = toDateKeyUTC(s.startDate);
      const endKey = toDateKeyUTC(s.endDate);
      (staysByRoom[s.roomId] ??= []).push({
        id: s.reservationId,
        roomId: s.roomId,
        startDate: formatUtcDateOnly(s.startDate),
        endDate: formatUtcDateOnly(s.endDate),
        startDateKey: startKey,
        endDateKey: endKey,
        status: publicStatus,
        guestName: s.reservation.guestName,
        source: s.reservation.source,
        channel: s.reservation.channel ?? null,
      });
    }

    const dates = enumerateDateOnly(from, to);
    // Comparisons are key-based (YYYY-MM-DD) to avoid timezone shifts.

    return NextResponse.json({
      from: formatUtcDateOnly(from),
      to: formatUtcDateOnly(to),
      dates,
      rooms: rooms.map((r: RoomRow) => ({
        ...r,
        blocks: blocksByRoom[r.id] ?? [],
        stays: staysByRoom[r.id] ?? [],
        occupancy: dates.map<Occupancy>((dayKey) => {
          const staysForRoom = staysByRoom[r.id] ?? [];
          for (const s of staysForRoom) {
            // Stays are night-based: checkout date is exclusive.
            // occupied iff: startKey <= dayKey AND dayKey < endKey
            if (s.startDateKey <= dayKey && dayKey < s.endDateKey) return "STAY";
          }
          const blocksForRoom = blocksByRoom[r.id] ?? [];
          for (const b of blocksForRoom) {
            // Blocks remain unchanged (date-only strings, end is treated as exclusive here).
            if (b.startDate <= dayKey && dayKey < b.endDate) return "BLOCK";
          }
          return "";
        }),
      })),
    });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
