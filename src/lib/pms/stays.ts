import { prisma } from "@/lib/prisma";
import { parseDateOnlyToUtcMidnight, formatUtcDateOnly } from "@/lib/pms/dates";
import { computeFolioTotals } from "@/lib/pms/folio";
import type { ReservationStatus } from "@prisma/client";

type ChargeLineType = "ROOM" | "FEE" | "TAX" | "DISCOUNT" | "ADJUSTMENT";
type ReportingPaymentStatus = "PENDING" | "CAPTURED" | "VOID" | "REFUNDED";
type ReportingPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";

function httpError(status: number, message: string) {
  const err = new Error(message);
  (err as any).status = status;
  return err;
}

export type StayStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

type DbStayStatus =
  ReservationStatus;

function dbToPublicStatus(status: DbStayStatus): StayStatus {
  return status === "HOLD" ? "DRAFT" : status;
}

function publicToDbStatus(status: StayStatus): DbStayStatus {
  return status === "DRAFT" ? "HOLD" : status;
}

const ACTIVE_STAY_DB_STATUSES: ReservationStatus[] = ["HOLD", "CONFIRMED", "CHECKED_IN"];

export function parseStayDates(input: { startDate: string; endDate: string }) {
  const start = parseDateOnlyToUtcMidnight(input.startDate);
  const end = parseDateOnlyToUtcMidnight(input.endDate);
  if (!(end > start)) {
    throw httpError(400, "endDate must be after startDate");
  }
  return { start, end };
}

export async function assertRoomAvailable(params: {
  propertyId: string;
  roomId: string;
  start: Date;
  end: Date;
  excludeReservationId?: string;
}) {
  const overlappingBlock = await prisma.block.findFirst({
    where: {
      propertyId: params.propertyId,
      roomId: params.roomId,
      startDate: { lt: params.end },
      endDate: { gt: params.start },
    },
    select: { id: true },
  });

  if (overlappingBlock) {
    throw httpError(400, "Room is blocked for selected dates");
  }

  const overlappingStay = await prisma.reservationStay.findFirst({
    where: {
      propertyId: params.propertyId,
      roomId: params.roomId,
      startDate: { lt: params.end },
      endDate: { gt: params.start },
      reservation: {
        status: { in: ACTIVE_STAY_DB_STATUSES },
        ...(params.excludeReservationId
          ? { NOT: { id: params.excludeReservationId } }
          : {}),
      },
    },
    select: { id: true },
  });

  if (overlappingStay) {
    throw httpError(400, "Room is occupied for selected dates");
  }
}

export async function createStay(params: {
  propertyId: string;
  createdByUserId: string;
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD exclusive
  guestName: string;
  guestEmail?: string | null;
  adults: number;
  children: number;
  notes?: string | null;
  source: "MANUAL" | "DIRECT";
}) {
  function splitFullName(fullName: string) {
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }

  const { start, end } = parseStayDates({
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const room = await prisma.room.findFirst({
    where: {
      id: params.roomId,
      propertyId: params.propertyId,
      isActive: true,
      status: "ACTIVE",
    },
    select: { id: true, roomTypeId: true },
  });

  if (!room) {
    throw httpError(400, "Invalid roomId");
  }

  await assertRoomAvailable({
    propertyId: params.propertyId,
    roomId: params.roomId,
    start,
    end,
  });

  const property = await prisma.property.findUnique({
    where: { id: params.propertyId },
    select: { currency: true },
  });

  if (!property) {
    throw httpError(400, "Invalid property");
  }

  const result = await prisma.$transaction(async (tx) => {
    const email = (params.guestEmail ?? "").trim().toLowerCase() || null;
    const { firstName, lastName } = splitFullName(params.guestName);

    const existingGuest = email
      ? await tx.guest.findFirst({
          where: { propertyId: params.propertyId, email },
          select: { id: true },
        })
      : null;

    const guest = existingGuest
      ? await tx.guest.update({
          where: { id: existingGuest.id },
          data: {
            firstName,
            lastName,
            email,
          },
          select: { id: true },
        })
      : await tx.guest.create({
          data: {
            propertyId: params.propertyId,
            firstName,
            lastName,
            email,
          },
          select: { id: true },
        });

    const reservation = await tx.reservation.create({
      data: {
        propertyId: params.propertyId,
        status: "CONFIRMED",
        source: params.source,
        guestName: params.guestName,
        guestEmail: email,
        bookerGuestId: guest.id,
        notes: params.notes ?? null,
        createdByUserId: params.createdByUserId,
      },
      select: { id: true, status: true, createdAt: true },
    });

    const stay = await tx.reservationStay.create({
      data: {
        propertyId: params.propertyId,
        reservationId: reservation.id,
        roomTypeId: room.roomTypeId,
        roomId: params.roomId,
        startDate: start,
        endDate: end,
        adults: params.adults,
        children: params.children,
      },
      select: {
        id: true,
        roomId: true,
        roomTypeId: true,
        startDate: true,
        endDate: true,
        adults: true,
        children: true,
      },
    });

    const folio = await tx.folio.create({
      data: {
        propertyId: params.propertyId,
        reservationId: reservation.id,
        currency: property.currency,
      },
      select: { id: true, currency: true, status: true },
    });

    return { reservation, stay, folio };
  });

  return {
    id: result.reservation.id,
    status: dbToPublicStatus(result.reservation.status),
    guestName: params.guestName,
    guestEmail: params.guestEmail ?? null,
    startDate: formatUtcDateOnly(result.stay.startDate),
    endDate: formatUtcDateOnly(result.stay.endDate),
    roomId: result.stay.roomId,
    roomTypeId: result.stay.roomTypeId,
    adults: result.stay.adults,
    children: result.stay.children,
    folioId: result.folio.id,
    currency: result.folio.currency,
  };
}

export function isValidStayTransition(from: StayStatus, to: StayStatus) {
  if (from === "DRAFT") return to === "CONFIRMED" || to === "CANCELLED";
  if (from === "CONFIRMED")
    return to === "CHECKED_IN" || to === "CANCELLED" || to === "NO_SHOW";
  if (from === "CHECKED_IN") return to === "CHECKED_OUT";
  return false;
}

export async function transitionStayStatus(params: {
  propertyId: string;
  reservationId: string;
  toStatus: StayStatus;
}) {
  if (params.toStatus === "DRAFT") {
    throw httpError(400, "Cannot transition to DRAFT");
  }

  const existing = await prisma.reservation.findFirst({
    where: { id: params.reservationId, propertyId: params.propertyId },
    select: {
      id: true,
      status: true,
      stays: {
        take: 1,
        select: {
          roomId: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (!existing) {
    throw httpError(404, "Not found");
  }

  const from = dbToPublicStatus(existing.status as DbStayStatus);
  if (!isValidStayTransition(from, params.toStatus)) {
    throw httpError(400, `Invalid transition ${from} → ${params.toStatus}`);
  }

  if (params.toStatus === "CONFIRMED" || params.toStatus === "CHECKED_IN") {
    const stayRow = existing.stays[0];
    if (!stayRow) {
      throw httpError(500, "Stay row missing");
    }
    await assertRoomAvailable({
      propertyId: params.propertyId,
      roomId: stayRow.roomId,
      start: stayRow.startDate,
      end: stayRow.endDate,
      excludeReservationId: existing.id,
    });
  }

  const updated = await prisma.reservation.update({
    where: { id: existing.id },
    data: { status: publicToDbStatus(params.toStatus) },
    select: { id: true, status: true, updatedAt: true },
  });

  return {
    id: updated.id,
    status: dbToPublicStatus(updated.status),
  };
}

export async function getStayDetails(params: {
  propertyId: string;
  reservationId: string;
}) {
  const stay = await prisma.reservation.findFirst({
    where: { id: params.reservationId, propertyId: params.propertyId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      source: true,
      channel: true,
      guestName: true,
      guestEmail: true,
      bookerGuestId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      stays: {
        take: 1,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          adults: true,
          children: true,
          room: { select: { id: true, name: true } },
          roomType: { select: { id: true, code: true, name: true } },
        },
      },
      folio: {
        select: {
          id: true,
          currency: true,
          status: true,
          lines: {
            orderBy: [{ postedAt: "asc" }],
            select: {
              id: true,
              type: true,
              amountCents: true,
              currency: true,
              description: true,
              postedAt: true,
              reversalOfLineId: true,
            },
          },
        },
      },
    },
  });

  if (!stay) {
    throw httpError(404, "Not found");
  }

  const stayRow = stay.stays?.[0];
  if (!stayRow) {
    throw httpError(500, "Stay row missing");
  }

  return {
    id: stay.id,
    status: dbToPublicStatus(stay.status),
    paymentStatus: stay.paymentStatus,
    source: stay.source,
    channel: stay.channel,
    guestName: stay.guestName,
    guestEmail: stay.guestEmail,
    guestId: stay.bookerGuestId,
    notes: stay.notes,
    startDate: formatUtcDateOnly(stayRow.startDate),
    endDate: formatUtcDateOnly(stayRow.endDate),
    adults: stayRow.adults,
    children: stayRow.children,
    room: stayRow.room,
    roomType: stayRow.roomType,
    folio: stay.folio,
  };
}

export async function addFolioLine(params: {
  propertyId: string;
  reservationId: string;
  createdByUserId: string;
  type: "CHARGE" | "PAYMENT";
  amountCents: number;
  description?: string | null;
  // Reporting breakdown (optional; caller decides how to classify)
  chargeType?: ChargeLineType | null;
  paymentStatus?: ReportingPaymentStatus | null;
  paymentMethod?: ReportingPaymentMethod | null;
  // Reporting day bucket override (YYYY-MM-DD). If omitted, uses today's UTC date.
  dateKey?: string;
}) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: params.reservationId, propertyId: params.propertyId },
    select: { id: true },
  });
  if (!reservation) {
    throw httpError(404, "Not found");
  }

  const folio = await prisma.folio.findUnique({
    where: { reservationId: reservation.id },
    select: { id: true, status: true, currency: true },
  });

  if (!folio) {
    throw httpError(500, "Folio missing");
  }

  if (folio.status !== "OPEN") {
    throw httpError(400, "Folio is closed");
  }

  const cents = Math.trunc(params.amountCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw httpError(400, "amountCents must be a positive integer");
  }

  const signedAmountCents = params.type === "PAYMENT" ? -cents : cents;

  const now = new Date();
  const dateKey = params.dateKey ?? formatUtcDateOnly(now);
  const date = parseDateOnlyToUtcMidnight(dateKey);

  const line = await prisma.folioLine.create({
    data: {
      propertyId: params.propertyId,
      folioId: folio.id,
      type: params.type,
      postedAt: now,
      dateKey,
      date,
      chargeType: params.type === "CHARGE" ? (params.chargeType ?? null) : null,
      paymentMethod: params.type === "PAYMENT" ? (params.paymentMethod ?? null) : null,
      paymentStatus: params.type === "PAYMENT" ? (params.paymentStatus ?? null) : null,
      amountCents: signedAmountCents,
      currency: folio.currency,
      description: params.description ?? null,
      createdByUserId: params.createdByUserId,
    } as any,
    select: {
      id: true,
      type: true,
      amountCents: true,
      currency: true,
      description: true,
      postedAt: true,
      reversalOfLineId: true,
    },
  });

  // Keep Reservation.paymentStatus in sync with folio balance.
  const summary = await getFolioSummary({
    propertyId: params.propertyId,
    reservationId: params.reservationId,
  });
  await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { paymentStatus: summary.paymentStatus },
    select: { id: true },
  });

  return line;
}

export async function reverseFolioLine(params: {
  propertyId: string;
  reservationId: string;
  createdByUserId: string;
  lineId: string;
}) {
  const folio = await prisma.folio.findUnique({
    where: { reservationId: params.reservationId },
    select: { id: true, status: true, currency: true },
  });

  if (!folio) {
    throw httpError(404, "Folio not found");
  }

  if (folio.status !== "OPEN") {
    throw httpError(400, "Folio is closed");
  }

  const original = await prisma.folioLine.findFirst({
    where: { id: params.lineId, propertyId: params.propertyId, folioId: folio.id },
    select: { id: true, amountCents: true, currency: true },
  });

  if (!original) {
    throw httpError(404, "Line not found");
  }

  const existingReversal = await prisma.folioLine.findFirst({
    where: {
      propertyId: params.propertyId,
      folioId: folio.id,
      reversalOfLineId: original.id,
    },
    select: { id: true },
  });

  if (existingReversal) {
    throw httpError(400, "Line already reversed");
  }

  const now = new Date();
  const dateKey = formatUtcDateOnly(now);
  const date = parseDateOnlyToUtcMidnight(dateKey);

  const reversal = await prisma.folioLine.create({
    data: {
      propertyId: params.propertyId,
      folioId: folio.id,
      type: "REVERSAL",
      postedAt: now,
      dateKey,
      date,
      amountCents: -original.amountCents,
      currency: original.currency,
      description: `Reversal of ${original.id}`,
      createdByUserId: params.createdByUserId,
      reversalOfLineId: original.id,
    } as any,
    select: {
      id: true,
      type: true,
      amountCents: true,
      currency: true,
      description: true,
      postedAt: true,
      reversalOfLineId: true,
    },
  });

  const summary = await getFolioSummary({
    propertyId: params.propertyId,
    reservationId: params.reservationId,
  });
  await prisma.reservation.update({
    where: { id: params.reservationId },
    data: { paymentStatus: summary.paymentStatus },
    select: { id: true },
  });

  return reversal;
}

export async function getFolioSummary(params: {
  propertyId: string;
  reservationId: string;
}) {
  const folio = await prisma.folio.findUnique({
    where: { reservationId: params.reservationId },
    select: {
      id: true,
      currency: true,
      status: true,
      lines: { select: { type: true, amountCents: true } },
    },
  });

  if (!folio) {
    throw httpError(404, "Folio not found");
  }

  const totals = computeFolioTotals(folio.lines);

  // Preserve previous naming for callers, but also return richer totals.
  const chargesCents = totals.subtotalCents;
  const paymentsCents = totals.paidCents;
  const balanceCents = totals.balanceCents;

  return {
    folioId: folio.id,
    currency: folio.currency,
    status: folio.status,
    chargesCents,
    paymentsCents,
    balanceCents,
    subtotalCents: totals.subtotalCents,
    paidCents: totals.paidCents,
    paymentStatus: totals.paymentStatus,
  };
}
