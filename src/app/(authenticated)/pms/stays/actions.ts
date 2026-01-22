"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  canManageStays,
  getActivePropertyContext,
} from "@/lib/propertyContext";
import {
  assertRoomAvailable,
  parseStayDates,
  transitionStayStatus,
  type StayStatus,
} from "@/lib/pms/stays";

function redirectWithError(message: string): never {
  redirect(`/pms/stays?error=${encodeURIComponent(message)}`);
}

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

export async function createStay(formData: FormData) {
  const { property, membership, user } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    redirectWithError("Forbidden");
  }

  const roomId = String(formData.get("roomId") ?? "");
  const checkInDate = String(formData.get("checkInDate") ?? "");
  const checkOutDate = String(formData.get("checkOutDate") ?? "");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = normalizeEmail(formData.get("email") as string | null);
  const phone = normalizePhone(formData.get("phone") as string | null);

  const channelRaw = String(formData.get("channel") ?? "").trim();
  const channel = channelRaw ? channelRaw : null;

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw ? notesRaw : null;

  const adults = Number(formData.get("adults") ?? 2);
  const children = Number(formData.get("children") ?? 0);

  if (!roomId) redirectWithError("Room is required");
  if (!checkInDate || !checkOutDate) redirectWithError("Dates are required");
  if (!firstName || !lastName) redirectWithError("Guest name is required");

  const { start, end } = parseStayDates({
    startDate: checkInDate,
    endDate: checkOutDate,
  });

  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId: property.id, isActive: true },
    select: { id: true, roomTypeId: true },
  });

  if (!room) {
    redirectWithError("Invalid room");
  }

  try {
    await assertRoomAvailable({
      propertyId: property.id,
      roomId: roomId,
      start,
      end,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Room availability check failed";
    redirectWithError(msg);
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
          data: {
            firstName,
            lastName,
            email,
            phone,
          },
          select: { id: true },
        })
      : await tx.guest.create({
          data: {
            propertyId: property.id,
            firstName,
            lastName,
            email,
            phone,
          },
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
        roomId,
        startDate: start,
        endDate: end,
        adults: Number.isFinite(adults) ? Math.max(1, Math.min(20, adults)) : 2,
        children: Number.isFinite(children)
          ? Math.max(0, Math.min(20, children))
          : 0,
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

export async function updateStayStatus(
  stayId: string,
  newStatus: StayStatus,
  _formData?: FormData,
) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    redirectWithError("Forbidden");
  }

  await transitionStayStatus({
    propertyId: property.id,
    reservationId: stayId,
    toStatus: newStatus,
  });

  if (newStatus === "CHECKED_OUT") {
    const stay = await prisma.reservationStay.findFirst({
      where: { propertyId: property.id, reservationId: stayId },
      select: { roomId: true },
    });

    if (stay?.roomId) {
      await prisma.room.updateMany({
        where: { id: stay.roomId, propertyId: property.id },
        data: { housekeepingStatus: "DIRTY" },
      });
    }
  }

  revalidatePath(`/pms/stays/${stayId}`);
  revalidatePath(`/pms/stays`);
  revalidatePath(`/pms/availability`);
}

export async function updatePaymentStatus(
  stayId: string,
  newPaymentStatus: PaymentStatus,
  _formData?: FormData,
) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    redirectWithError("Forbidden");
  }

  await prisma.reservation.updateMany({
    where: { id: stayId, propertyId: property.id },
    data: { paymentStatus: newPaymentStatus },
  });

  revalidatePath(`/pms/stays/${stayId}`);
  revalidatePath(`/pms/stays`);
}

export async function updateStayNotes(stayId: string, formData: FormData) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    redirectWithError("Forbidden");
  }

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw ? notesRaw : null;

  await prisma.reservation.updateMany({
    where: { id: stayId, propertyId: property.id },
    data: { notes },
  });

  revalidatePath(`/pms/stays/${stayId}`);
  revalidatePath(`/pms/stays`);
}

export async function updateStayDates(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { property, membership } = await getActivePropertyContext();
    if (!canManageStays(membership)) {
      throw new Error("Forbidden");
    }

    const checkInDate = String(formData.get("checkInDate") ?? "").trim();
    const checkOutDate = String(formData.get("checkOutDate") ?? "").trim();
    if (!stayId) throw new Error("Missing stayId");
    if (!checkInDate || !checkOutDate) throw new Error("Dates are required");

    const stay = await prisma.reservationStay.findFirst({
      where: { reservationId: stayId, propertyId: property.id },
      select: { roomId: true },
    });
    if (!stay) throw new Error("Stay not found");

    const { start, end } = parseStayDates({ startDate: checkInDate, endDate: checkOutDate });

    await assertRoomAvailable({
      propertyId: property.id,
      roomId: stay.roomId,
      start,
      end,
      excludeReservationId: stayId,
    });

    await prisma.reservationStay.updateMany({
      where: { reservationId: stayId, propertyId: property.id },
      data: { startDate: start, endDate: end },
    });

    revalidatePath(`/pms/stays/${stayId}`);
    revalidatePath(`/pms/stays`);
    revalidatePath(`/pms/availability`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update dates";
    if (stayId) redirect(`/pms/stays/${stayId}?datesError=${encodeURIComponent(message)}#dates`);
    throw err;
  }
}

export async function updateStayRoom(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { property, membership } = await getActivePropertyContext();
    if (!canManageStays(membership)) {
      throw new Error("Forbidden");
    }

    const newRoomId = String(formData.get("newRoomId") ?? "").trim();
    if (!stayId) throw new Error("Missing stayId");
    if (!newRoomId) throw new Error("Room is required");

    const stay = await prisma.reservationStay.findFirst({
      where: { reservationId: stayId, propertyId: property.id },
      select: { startDate: true, endDate: true, roomId: true },
    });
    if (!stay) throw new Error("Stay not found");

    const room = await prisma.room.findFirst({
      where: { id: newRoomId, propertyId: property.id, isActive: true, status: "ACTIVE" },
      select: { id: true, roomTypeId: true },
    });
    if (!room) throw new Error("Invalid room");

    await assertRoomAvailable({
      propertyId: property.id,
      roomId: room.id,
      start: stay.startDate,
      end: stay.endDate,
      excludeReservationId: stayId,
    });

    await prisma.reservationStay.updateMany({
      where: { reservationId: stayId, propertyId: property.id },
      data: { roomId: room.id, roomTypeId: room.roomTypeId },
    });

    revalidatePath(`/pms/stays/${stayId}`);
    revalidatePath(`/pms/stays`);
    revalidatePath(`/pms/availability`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to move room";
    if (stayId) redirect(`/pms/stays/${stayId}?roomError=${encodeURIComponent(message)}#room`);
    throw err;
  }
}
