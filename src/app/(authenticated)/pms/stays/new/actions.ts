"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { assertRoomAvailable, parseStayDates } from "@/lib/pms/stays";

type AvailabilityRoom = {
  id: string;
  name: string;
  roomType: {
    code: string;
    name: string;
  };
};

export type AvailabilityState = {
  ok: boolean;
  error: string | null;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId: string;
  adults: string;
  children: string;
  availableRooms: AvailabilityRoom[];
};

export type CreateReservationState = {
  ok: boolean;
  error: string | null;
};

function normalizeEmail(email: string | null) {
  const trimmed = (email ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizePhone(phone: string | null) {
  const trimmed = (phone ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeNamePart(value: string) {
  return value.trim().toLowerCase();
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function searchAvailability(
  _prevState: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const { property } = await getActivePropertyContext();

  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");
  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const adults = String(formData.get("adults") ?? "");
  const children = String(formData.get("children") ?? "");

  const baseState: AvailabilityState = {
    ok: false,
    error: null,
    checkInDate,
    checkOutDate,
    roomTypeId,
    adults,
    children,
    availableRooms: [],
  };

  if (!checkInDate || !checkOutDate) {
    return { ...baseState, error: "Dates are required." };
  }
  if (!roomTypeId) {
    return { ...baseState, error: "Room type is required." };
  }

  let start: Date;
  let end: Date;
  try {
    ({ start, end } = parseStayDates({ startDate: checkInDate, endDate: checkOutDate }));
  } catch (err) {
    return {
      ...baseState,
      error: err instanceof Error ? err.message : "Invalid dates",
    };
  }

  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId: property.id, isActive: true },
    select: { id: true },
  });
  if (!roomType) {
    return { ...baseState, error: "Invalid room type." };
  }

  const [rooms, overlappingStays, overlappingBlocks] = await Promise.all([
    prisma.room.findMany({
      where: {
        propertyId: property.id,
        roomTypeId,
        isActive: true,
        status: "ACTIVE",
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        roomType: { select: { code: true, name: true } },
      },
    }),
    prisma.reservationStay.findMany({
      where: {
        propertyId: property.id,
        roomTypeId,
        startDate: { lt: end },
        endDate: { gt: start },
        reservation: {
          status: { in: ["HOLD", "CONFIRMED", "CHECKED_IN"] },
        },
      },
      select: { roomId: true },
    }),
    prisma.block.findMany({
      where: {
        propertyId: property.id,
        room: { roomTypeId },
        startDate: { lt: end },
        endDate: { gt: start },
      },
      select: { roomId: true },
    }),
  ]);

  const occupiedRoomIds = new Set(overlappingStays.map((s) => s.roomId));
  const blockedRoomIds = new Set(overlappingBlocks.map((b) => b.roomId));

  const availableRooms = rooms.filter(
    (r) => !occupiedRoomIds.has(r.id) && !blockedRoomIds.has(r.id),
  );

  return {
    ...baseState,
    ok: true,
    availableRooms,
  };
}

export async function createReservationFromSearch(
  _prevState: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const { property, membership, user } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    return { ok: false, error: "Forbidden" };
  }

  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");
  const roomTypeId = String(formData.get("roomTypeId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = normalizeEmail(formData.get("email") as string | null);
  const phone = normalizePhone(formData.get("phone") as string | null);

  const channelRaw = String(formData.get("channel") ?? "DIRECT").trim();
  const channel = channelRaw ? channelRaw : "DIRECT";

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw ? notesRaw : null;

  const adults = clampInt(formData.get("adults"), 1, 20, 2);
  const children = clampInt(formData.get("children"), 0, 20, 0);

  if (!roomTypeId) return { ok: false, error: "Room type is required." };
  if (!roomId) return { ok: false, error: "Room is required." };
  if (!checkInDate || !checkOutDate) return { ok: false, error: "Dates are required." };
  if (!firstName || !lastName) return { ok: false, error: "Guest name is required." };

  let start: Date;
  let end: Date;
  try {
    ({ start, end } = parseStayDates({ startDate: checkInDate, endDate: checkOutDate }));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid dates" };
  }

  const [roomType, room] = await Promise.all([
    prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: property.id, isActive: true },
      select: { id: true },
    }),
    prisma.room.findFirst({
      where: {
        id: roomId,
        propertyId: property.id,
        roomTypeId,
        isActive: true,
        status: "ACTIVE",
      },
      select: { id: true, roomTypeId: true },
    }),
  ]);

  if (!roomType) return { ok: false, error: "Invalid room type." };
  if (!room) return { ok: false, error: "Invalid room." };

  try {
    await assertRoomAvailable({
      propertyId: property.id,
      roomId: room.id,
      start,
      end,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Room is not available",
    };
  }

  const guestName = `${firstName} ${lastName}`.trim();

  const reservationId = await prisma.$transaction(async (tx) => {
    const existingGuest =
      email || phone
        ? await tx.guest.findFirst({
            where: {
              propertyId: property.id,
              OR: [
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
              ],
            },
            select: { id: true, firstName: true, lastName: true },
          })
        : null;

    const canReuseExistingGuest =
      !!existingGuest &&
      normalizeNamePart(existingGuest.firstName) === normalizeNamePart(firstName) &&
      normalizeNamePart(existingGuest.lastName) === normalizeNamePart(lastName);

    const guest = existingGuest && canReuseExistingGuest
      ? await tx.guest.update({
          where: { id: existingGuest.id },
          data: { firstName, lastName, email, phone },
          select: { id: true },
        })
      : await tx.guest.create({
          data: { propertyId: property.id, firstName, lastName, email, phone },
          select: { id: true },
        });

    const reservation = await tx.reservation.create({
      data: {
        propertyId: property.id,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        source: "MANUAL",
        channel,
        guestName,
        guestEmail: email,
        bookerGuestId: guest.id,
        notes,
        createdByUserId: user.id,
      },
      select: { id: true },
    });

    await tx.reservationStay.create({
      data: {
        propertyId: property.id,
        reservationId: reservation.id,
        roomTypeId: room.roomTypeId,
        roomId: room.id,
        startDate: start,
        endDate: end,
        adults,
        children,
      },
      select: { id: true },
    });

    await tx.folio.create({
      data: {
        propertyId: property.id,
        reservationId: reservation.id,
        currency: property.currency,
      },
      select: { id: true },
    });

    return reservation.id;
  });

  redirect(`/pms/stays/${reservationId}`);
}
