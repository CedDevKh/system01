import "server-only";

import { prisma } from "@/lib/prisma";
import {
  enumerateDateOnly,
  formatUtcDateOnly,
  parseDateOnlyToUtcMidnight,
} from "@/lib/pms/dates";
import type { ReservationStatus } from "@prisma/client";

export type RangeMode = "today" | "tomorrow" | "next7";

export type StayStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export type DashboardActionItem = {
  id: string;
  type: "departuresPending" | "arrivalsUnassigned" | "arrivalsNotClean";
  priority: 1 | 2 | 3;
  title: string;
  subtitle: string;
  href: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  requiresManagePermission: boolean;
};

export type DashboardData = {
  range: {
    mode: RangeMode;
    startDateKey: string;
    endDateKeyExclusive: string;
  };
  kpis: {
    arrivalsCount: number;
    departuresCount: number;
    inHouseCount: number;
    occupancy: {
      sold: number;
      total: number;
      pct: number | null;
    };
  };
  lists: {
    arrivals: Array<{
      stayId: string;
      guestName: string;
      roomTypeName: string;
      roomName?: string;
      source?: string;
      eta?: string;
      status: StayStatus;
    }>;
    departures: Array<{
      stayId: string;
      guestName: string;
      roomName?: string;
      balance?: string;
      status: StayStatus;
    }>;
    inHouse: Array<{
      stayId: string;
      guestName: string;
      roomName?: string;
      roomTypeName: string;
      checkoutDateKey: string;
      status: StayStatus;
    }>;
  };
  housekeepingSummary: {
    dirtyCount: number;
    cleanCount: number;
    needsInspectionCount: number;
    arrivalsNotCleanCount: number;
  };
  availabilitySnapshot: {
    byRoomType: Array<{
      roomTypeId: string;
      roomTypeName: string;
      available: number;
      total: number;
    }>;
  };
  actionCenter: Array<DashboardActionItem>;
};

const ACTIVE_SOLD_DB_STATUSES: ReservationStatus[] = [
  "HOLD",
  "CONFIRMED",
  "CHECKED_IN",
];

function dbToPublicStatus(status: ReservationStatus): StayStatus {
  return status === "HOLD" ? "DRAFT" : status;
}

function addDaysUtc(dateOnlyKey: string, days: number) {
  const d = parseDateOnlyToUtcMidnight(dateOnlyKey);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateOnly(d);
}

export function resolveRangeMode(input: unknown): RangeMode {
  if (input === "today" || input === "tomorrow" || input === "next7") return input;
  return "today";
}

function computeRange(mode: RangeMode) {
  const todayKey = formatUtcDateOnly(new Date());

  if (mode === "today") {
    return {
      mode,
      startDateKey: todayKey,
      endDateKeyExclusive: addDaysUtc(todayKey, 1),
    };
  }

  if (mode === "tomorrow") {
    const tomorrowKey = addDaysUtc(todayKey, 1);
    return {
      mode,
      startDateKey: tomorrowKey,
      endDateKeyExclusive: addDaysUtc(tomorrowKey, 1),
    };
  }

  // next7
  return {
    mode,
    startDateKey: todayKey,
    endDateKeyExclusive: addDaysUtc(todayKey, 7),
  };
}

export async function getDashboardData(params: {
  propertyId: string;
  rangeMode: RangeMode;
}): Promise<DashboardData> {
  const range = computeRange(params.rangeMode);

  const rangeStart = parseDateOnlyToUtcMidnight(range.startDateKey);
  const rangeEndExclusive = parseDateOnlyToUtcMidnight(range.endDateKeyExclusive);

  const dayStart = rangeStart;
  const dayEndExclusive = (() => {
    const d = new Date(dayStart);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  })();

  const [
    totalRooms,
    arrivals,
    departures,
    inHouse,
    soldForDay,
    rooms,
    roomTypes,
    totalByRoomType,
    soldByRoomType,
    arrivalsForHousekeeping,
  ] = await Promise.all([
    prisma.room.count({
      where: {
        propertyId: params.propertyId,
        isActive: true,
        status: "ACTIVE",
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: params.propertyId,
        startDate: { gte: rangeStart, lt: rangeEndExclusive },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] },
        },
      },
      orderBy: [{ startDate: "asc" }],
      take: 50,
      select: {
        reservationId: true,
        startDate: true,
        room: {
          select: {
            name: true,
            housekeepingStatus: true,
          },
        },
        roomType: { select: { name: true } },
        reservation: {
          select: {
            status: true,
            guestName: true,
            source: true,
            channel: true,
          },
        },
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: params.propertyId,
        endDate: { gte: rangeStart, lt: rangeEndExclusive },
        reservation: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        },
      },
      orderBy: [{ endDate: "asc" }],
      take: 50,
      select: {
        reservationId: true,
        endDate: true,
        room: { select: { name: true } },
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
        propertyId: params.propertyId,
        startDate: { lt: dayEndExclusive },
        endDate: { gt: dayStart },
        reservation: { status: "CHECKED_IN" },
      },
      orderBy: [{ endDate: "asc" }],
      take: 200,
      select: {
        reservationId: true,
        endDate: true,
        room: { select: { name: true } },
        roomType: { select: { name: true } },
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
        propertyId: params.propertyId,
        startDate: { lt: dayEndExclusive },
        endDate: { gt: dayStart },
        reservation: {
          status: { in: ACTIVE_SOLD_DB_STATUSES },
        },
      },
      select: {
        roomId: true,
      },
    }),
    prisma.room.findMany({
      where: {
        propertyId: params.propertyId,
      },
      select: {
        housekeepingStatus: true,
      },
    }),
    prisma.roomType.findMany({
      where: { propertyId: params.propertyId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.room.groupBy({
      by: ["roomTypeId"],
      where: {
        propertyId: params.propertyId,
        isActive: true,
        status: "ACTIVE",
      },
      _count: { _all: true },
    }),
    prisma.reservationStay.groupBy({
      by: ["roomTypeId"],
      where: {
        propertyId: params.propertyId,
        startDate: { lt: dayEndExclusive },
        endDate: { gt: dayStart },
        reservation: { status: { in: ACTIVE_SOLD_DB_STATUSES } },
      },
      _count: { _all: true },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: params.propertyId,
        startDate: { gte: rangeStart, lt: rangeEndExclusive },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] },
        },
      },
      select: {
        room: {
          select: {
            housekeepingStatus: true,
          },
        },
      },
    }),
  ]);

  const soldRoomIds = new Set(soldForDay.map((r) => r.roomId).filter(Boolean));

  const occupiedRooms = soldRoomIds.size;
  const occupancyPercent =
    totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : null;

  const arrivalsCount = arrivals.length;
  const departuresCount = departures.length;
  const inHouseCount = inHouse.length;

  const dirtyCount = rooms.filter((r) => r.housekeepingStatus === "DIRTY").length;
  const cleanCount = rooms.filter((r) => r.housekeepingStatus === "CLEAN").length;
  const needsInspectionCount = rooms.filter(
    (r) => r.housekeepingStatus === "INSPECT",
  ).length;

  const arrivalsNotCleanCount = arrivalsForHousekeeping.filter(
    (s) => s.room.housekeepingStatus !== "CLEAN",
  ).length;

  const totalByRoomTypeMap = new Map<string, number>();
  for (const row of totalByRoomType) {
    totalByRoomTypeMap.set(row.roomTypeId, row._count._all);
  }

  const soldByRoomTypeMap = new Map<string, number>();
  for (const row of soldByRoomType) {
    soldByRoomTypeMap.set(row.roomTypeId, row._count._all);
  }

  const byRoomType = roomTypes.map((rt) => {
    const total = totalByRoomTypeMap.get(rt.id) ?? 0;
    const sold = soldByRoomTypeMap.get(rt.id) ?? 0;
    const available = Math.max(0, total - sold);
    return {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      available,
      total,
    };
  });

  const dayKeys = enumerateDateOnly(rangeStart, rangeEndExclusive);
  const queryDateLabel =
    range.mode === "next7"
      ? `${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]}`
      : dayKeys[0];

  const departuresPendingCount = await prisma.reservationStay.count({
    where: {
      propertyId: params.propertyId,
      endDate: { gte: rangeStart, lt: rangeEndExclusive },
      reservation: { status: "CHECKED_IN" },
    },
  });

  const arrivalsNotCleanTodayCount = await prisma.reservationStay.count({
    where: {
      propertyId: params.propertyId,
      startDate: { gte: rangeStart, lt: rangeEndExclusive },
      reservation: { status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] } },
      room: {
        housekeepingStatus: { not: "CLEAN" },
      },
    },
  });

  const arrivalsUnassignedCount = await prisma.reservationStay.count({
    where: {
      propertyId: params.propertyId,
      startDate: { gte: rangeStart, lt: rangeEndExclusive },
      reservation: { status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] } },
      // Schema currently requires roomId, but keep this in place in case
      // unassigned stays are represented as an empty string in older data.
      roomId: "",
    },
  });

  const actionCenter: DashboardActionItem[] = [];

  if (arrivalsNotCleanTodayCount > 0) {
    actionCenter.push({
      id: "arrivals-not-clean",
      type: "arrivalsNotClean",
      priority: 1,
      title: `${arrivalsNotCleanTodayCount} arriving room(s) not clean`,
      subtitle: `Date: ${queryDateLabel}`,
      href: `/pms/housekeeping?rangeMode=${range.mode}`,
      primaryActionLabel: "Open housekeeping",
      primaryActionHref: `/pms/housekeeping?rangeMode=${range.mode}`,
      requiresManagePermission: false,
    });
  }

  if (departuresPendingCount > 0) {
    actionCenter.push({
      id: "departures-pending",
      type: "departuresPending",
      priority: 2,
      title: `${departuresPendingCount} departure(s) pending checkout`,
      subtitle: `Date: ${queryDateLabel}`,
      href: `/pms/stays?rangeMode=${range.mode}`,
      primaryActionLabel: "View stays",
      primaryActionHref: `/pms/stays?rangeMode=${range.mode}`,
      requiresManagePermission: true,
    });
  }

  if (arrivalsUnassignedCount > 0) {
    actionCenter.push({
      id: "arrivals-unassigned",
      type: "arrivalsUnassigned",
      priority: 3,
      title: `${arrivalsUnassignedCount} arrival(s) unassigned`,
      subtitle: `Date: ${queryDateLabel}`,
      href: `/pms/availability?rangeMode=${range.mode}`,
      primaryActionLabel: "Open availability",
      primaryActionHref: `/pms/availability?rangeMode=${range.mode}`,
      requiresManagePermission: true,
    });
  }

  actionCenter.sort((a, b) => a.priority - b.priority);

  return {
    range,
    kpis: {
      arrivalsCount,
      departuresCount,
      inHouseCount,
      occupancy: {
        sold: occupiedRooms,
        total: totalRooms,
        pct: occupancyPercent,
      },
    },
    lists: {
      arrivals: arrivals.map((a) => ({
        stayId: a.reservationId,
        guestName: a.reservation.guestName,
        roomTypeName: a.roomType.name,
        roomName: a.room?.name ?? undefined,
        source: a.reservation.channel ?? a.reservation.source,
        status: dbToPublicStatus(a.reservation.status),
      })),
      departures: departures.map((d) => ({
        stayId: d.reservationId,
        guestName: d.reservation.guestName,
        roomName: d.room?.name ?? undefined,
        status: dbToPublicStatus(d.reservation.status),
      })),
      inHouse: inHouse.map((s) => ({
        stayId: s.reservationId,
        guestName: s.reservation.guestName,
        roomName: s.room?.name ?? undefined,
        roomTypeName: s.roomType.name,
        checkoutDateKey: formatUtcDateOnly(s.endDate),
        status: dbToPublicStatus(s.reservation.status),
      })),
    },
    housekeepingSummary: {
      dirtyCount,
      cleanCount,
      needsInspectionCount,
      arrivalsNotCleanCount,
    },
    availabilitySnapshot: {
      byRoomType,
    },
    actionCenter,
  };
}
