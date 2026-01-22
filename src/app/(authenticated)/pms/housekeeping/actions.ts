"use server";

import { revalidatePath } from "next/cache";

import type { HousekeepingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";

const allowedStatuses = [
  "CLEAN",
  "DIRTY",
  "INSPECT",
  "OUT_OF_SERVICE",
] as const;

function isHousekeepingStatus(value: string): value is HousekeepingStatus {
  return (allowedStatuses as readonly string[]).includes(value);
}

export async function updateHousekeepingStatus(formData: FormData) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    return;
  }

  const roomId = String(formData.get("roomId") ?? "");
  const statusRaw = String(formData.get("status") ?? "");

  if (!roomId) return;
  if (!isHousekeepingStatus(statusRaw)) return;

  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId: property.id },
    select: { id: true },
  });

  if (!room) return;

  await prisma.room.update({
    where: { id: room.id },
    data: { housekeepingStatus: statusRaw },
    select: { id: true },
  });

  revalidatePath("/pms/housekeeping");
}
