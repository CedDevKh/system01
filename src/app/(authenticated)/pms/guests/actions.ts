"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";

export async function updateGuestNotes(formData: FormData) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) {
    return;
  }

  const guestId = String(formData.get("guestId") ?? "");
  const notesRaw = String(formData.get("internalNotes") ?? "");
  const notes = notesRaw.trim() ? notesRaw.trim() : null;

  if (!guestId) return;

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, propertyId: property.id },
    select: { id: true },
  });
  if (!guest) return;

  await prisma.guest.update({
    where: { id: guest.id },
    data: { notes },
    select: { id: true },
  });

  revalidatePath(`/pms/guests/${guestId}`);
}
