"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { addFolioLine, reverseFolioLine } from "@/lib/pms/stays";
import { parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

const MANAGE_ROLES = new Set(["OWNER", "MANAGER"]);

function assertCanManage(role: string) {
  if (!MANAGE_ROLES.has(role)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
}

function dollarsToCents(input: string) {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

function formatMoney(cents: number, currency: string) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  const dollars = (abs / 100).toFixed(2);
  return `${sign}${currency} ${dollars}`;
}

export async function addCharge(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    assertCanManage(role);

    const itemType = String(formData.get("itemType") ?? "SERVICE");
    const descriptionRaw = String(formData.get("description") ?? "").trim();
    const qty = Number(formData.get("quantity") ?? 1);
    const unitPrice = String(formData.get("unitPrice") ?? "").trim();
    const serviceDateRaw = String(formData.get("serviceDate") ?? "").trim();

    if (!stayId) throw new Error("Missing stayId");
    if (!descriptionRaw) throw new Error("Description is required");

    const quantity = Number.isFinite(qty)
      ? Math.max(1, Math.min(999, Math.trunc(qty)))
      : 1;
    const unitCents = dollarsToCents(unitPrice);
    if (!unitCents || unitCents <= 0) throw new Error("Invalid unit price");

    const totalCents = quantity * unitCents;
    const serviceDate = serviceDateRaw
      ? parseDateOnlyToUtcMidnight(serviceDateRaw)
      : null;

    // Verify stay belongs to active property.
    const res = await prisma.reservation.findFirst({
      where: { id: stayId, propertyId: activePropertyId },
      select: { id: true },
    });
    if (!res) throw new Error("Not found");

    const desc = `[${itemType}] ${descriptionRaw}${quantity !== 1 ? ` (x${quantity})` : ""}`;

    await addFolioLine({
      propertyId: activePropertyId,
      reservationId: stayId,
      createdByUserId: user.id,
      type: "CHARGE",
      amountCents: totalCents,
      description: serviceDate ? `${desc} @ ${serviceDateRaw}` : desc,
    });

    revalidatePath(`/pms/stays/${stayId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add charge";
    if (stayId) redirect(`/pms/stays/${stayId}?error=${encodeURIComponent(message)}`);
    throw err;
  }
}

export async function recordPayment(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    assertCanManage(role);

    const method = String(formData.get("method") ?? "CASH");
    const amount = String(formData.get("amount") ?? "").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!stayId) throw new Error("Missing stayId");

    const cents = dollarsToCents(amount);
    if (!cents || cents <= 0) throw new Error("Invalid amount");

    const res = await prisma.reservation.findFirst({
      where: { id: stayId, propertyId: activePropertyId },
      select: { id: true },
    });
    if (!res) throw new Error("Not found");

    const descParts = [`Payment (${method})`];
    if (reference) descParts.push(`Ref: ${reference}`);
    if (notes) descParts.push(notes);

    await addFolioLine({
      propertyId: activePropertyId,
      reservationId: stayId,
      createdByUserId: user.id,
      type: "PAYMENT",
      amountCents: cents,
      description: descParts.join(" · "),
    });

    revalidatePath(`/pms/stays/${stayId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record payment";
    if (stayId) redirect(`/pms/stays/${stayId}?error=${encodeURIComponent(message)}`);
    throw err;
  }
}

export async function reverseLine(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    assertCanManage(role);

    const lineId = String(formData.get("lineId") ?? "");
    if (!stayId || !lineId) return;

    await reverseFolioLine({
      propertyId: activePropertyId,
      reservationId: stayId,
      createdByUserId: user.id,
      lineId,
    });

    revalidatePath(`/pms/stays/${stayId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reverse line";
    if (stayId) redirect(`/pms/stays/${stayId}?error=${encodeURIComponent(message)}`);
    throw err;
  }
}

export async function postRoomCharges(formData: FormData) {
  const stayId = String(formData.get("stayId") ?? "");
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    assertCanManage(role);

    if (!stayId) throw new Error("Missing stayId");

    const property = await prisma.property.findFirst({
      where: { id: activePropertyId },
      select: { id: true, currency: true, defaultRatePlanId: true },
    });
    if (!property) throw new Error("Property not found");

    const stay = await prisma.reservationStay.findFirst({
      where: {
        reservationId: stayId,
        propertyId: activePropertyId,
      },
      select: {
        startDate: true,
        endDate: true,
        roomTypeId: true,
        roomType: { select: { name: true, baseRateCents: true } },
      },
    });

    if (!stay) throw new Error("Stay not found");

    const nights = Math.max(
      1,
      Math.round((stay.endDate.getTime() - stay.startDate.getTime()) / (24 * 60 * 60 * 1000)),
    );

    let defaultRatePlan = property.defaultRatePlanId
      ? await prisma.ratePlan.findFirst({
          where: {
            id: property.defaultRatePlanId,
            propertyId: activePropertyId,
            isActive: true,
          },
          select: { id: true, currency: true },
        })
      : null;

    if (!defaultRatePlan) {
      defaultRatePlan = await prisma.ratePlan.findFirst({
        where: { propertyId: activePropertyId, isDefault: true, isActive: true },
        select: { id: true, currency: true },
      });
    }

    let nightlyRateCents: number | null = null;

    if (defaultRatePlan) {
      const rtRate = await prisma.ratePlanRoomType.findUnique({
        where: {
          ratePlanId_roomTypeId: {
            ratePlanId: defaultRatePlan.id,
            roomTypeId: stay.roomTypeId,
          },
        },
        select: { nightlyRateCents: true },
      });

      if (rtRate?.nightlyRateCents && rtRate.nightlyRateCents > 0) {
        nightlyRateCents = rtRate.nightlyRateCents;
      }
    }

    if (nightlyRateCents === null) {
      const legacy = stay.roomType.baseRateCents;
      if (legacy && legacy > 0) {
        nightlyRateCents = legacy;
      }
    }

    if (nightlyRateCents === null) {
      throw new Error(
        defaultRatePlan
          ? "No rate configured for this room type in the default rate plan."
          : "No rate plan configured and room type base rate is not set.",
      );
    }

    const currency = defaultRatePlan?.currency ?? property.currency;
    const rateLabel = formatMoney(nightlyRateCents, currency);

    await addFolioLine({
      propertyId: activePropertyId,
      reservationId: stayId,
      createdByUserId: user.id,
      type: "CHARGE",
      amountCents: nights * nightlyRateCents,
      description: `[ROOM] Room charge: ${stay.roomType.name} (${nights} nights @ ${rateLabel})`,
    });

    revalidatePath(`/pms/stays/${stayId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post room charges";
    if (stayId) redirect(`/pms/stays/${stayId}?error=${encodeURIComponent(message)}`);
    throw err;
  }
}
