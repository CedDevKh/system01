"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";

function parseMoneyToCents(inputRaw: string) {
  const input = inputRaw.trim();
  if (!input) return 0;

  // Accept: "75", "75.0", "75.00" (no thousands separators).
  const match = input.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const dollarsPart = match[2];
  const centsPart = (match[3] ?? "").padEnd(2, "0");

  const dollars = Number(dollarsPart);
  const cents = centsPart ? Number(centsPart) : 0;

  if (!Number.isFinite(dollars) || !Number.isFinite(cents)) return null;

  const total = sign * (dollars * 100 + cents);
  if (!Number.isSafeInteger(total)) return null;
  return total;
}

export async function createRatePlan(formData: FormData) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) return;

  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();

  const code = codeRaw.toUpperCase();
  const description = descriptionRaw ? descriptionRaw : null;

  if (!name) return;
  if (!code) return;

  await prisma.ratePlan.create({
    data: {
      propertyId: property.id,
      name,
      code,
      description,
      currency: property.currency,
      isDefault: false,
      isActive: true,
    },
    select: { id: true },
  });

  revalidatePath("/pms/rates");
}

export async function setDefaultRatePlan(ratePlanId: string) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) return;

  const plan = await prisma.ratePlan.findFirst({
    where: { id: ratePlanId, propertyId: property.id },
    select: { id: true },
  });
  if (!plan) return;

  await prisma.$transaction([
    prisma.ratePlan.updateMany({
      where: { propertyId: property.id },
      data: { isDefault: false },
    }),
    prisma.ratePlan.update({
      where: { id: plan.id },
      data: { isDefault: true },
      select: { id: true },
    }),
    prisma.property.update({
      where: { id: property.id },
      data: { defaultRatePlanId: plan.id },
      select: { id: true },
    }),
  ]);

  revalidatePath("/pms/rates");
}

export async function updateRatePlanRoomTypeRates(formData: FormData) {
  const { property, membership } = await getActivePropertyContext();
  if (!canManageStays(membership)) return;

  const ratePlanId = String(formData.get("ratePlanId") ?? "").trim();
  if (!ratePlanId) return;

  const plan = await prisma.ratePlan.findFirst({
    where: { id: ratePlanId, propertyId: property.id },
    select: { id: true },
  });
  if (!plan) return;

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    select: { id: true },
  });

  for (const rt of roomTypes) {
    const key = `rates[${rt.id}]`;
    const raw = String(formData.get(key) ?? "");
    const nightlyRateCents = parseMoneyToCents(raw);
    if (nightlyRateCents === null) {
      continue;
    }

    await prisma.ratePlanRoomType.upsert({
      where: {
        ratePlanId_roomTypeId: {
          ratePlanId: plan.id,
          roomTypeId: rt.id,
        },
      },
      create: {
        propertyId: property.id,
        ratePlanId: plan.id,
        roomTypeId: rt.id,
        nightlyRateCents,
      },
      update: { nightlyRateCents },
      select: { id: true },
    });
  }

  revalidatePath("/pms/rates");
}
