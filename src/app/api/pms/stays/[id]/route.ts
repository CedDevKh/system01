import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import {
  assertRoomAvailable,
  getStayDetails,
  parseStayDates,
  transitionStayStatus,
  type StayStatus,
} from "@/lib/pms/stays";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.union([
  z.object({ action: z.literal("CONFIRM") }),
  z.object({ action: z.literal("CHECK_IN") }),
  z.object({ action: z.literal("CHECK_OUT") }),
  z.object({ action: z.literal("CANCEL") }),
  z.object({ action: z.literal("SET_DATES"), startDate: dateOnly, endDate: dateOnly }),
]);

function actionToStatus(action: string): StayStatus {
  if (action === "CONFIRM") return "CONFIRMED";
  if (action === "CHECK_IN") return "CHECKED_IN";
  if (action === "CHECK_OUT") return "CHECKED_OUT";
  return "CANCELLED";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId } = await requireActivePropertyScope();
    const { id } = await ctx.params;

    const stay = await getStayDetails({
      propertyId: activePropertyId,
      reservationId: id,
    });

    return NextResponse.json({ stay });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(["OWNER", "MANAGER", "RECEPTIONIST"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const input = patchSchema.parse(body);

    if (input.action === "SET_DATES") {
      const existing = await prisma.reservation.findFirst({
        where: { id, propertyId: activePropertyId },
        select: {
          id: true,
          status: true,
          stays: {
            take: 1,
            select: {
              id: true,
              roomId: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Only allow date changes for active stays.
      if (!(["HOLD", "CONFIRMED", "CHECKED_IN"] as const).includes(existing.status as any)) {
        return NextResponse.json({ error: "Cannot modify dates for this stay" }, { status: 400 });
      }

      const stayRow = existing.stays?.[0];
      if (!stayRow) {
        return NextResponse.json({ error: "Stay row missing" }, { status: 500 });
      }

      const { start, end } = parseStayDates({
        startDate: input.startDate,
        endDate: input.endDate,
      });

      await assertRoomAvailable({
        propertyId: activePropertyId,
        roomId: stayRow.roomId,
        start,
        end,
        excludeReservationId: existing.id,
      });

      await prisma.reservationStay.update({
        where: { id: stayRow.id },
        data: { startDate: start, endDate: end },
        select: { id: true },
      });

      const updated = await getStayDetails({ propertyId: activePropertyId, reservationId: id });
      return NextResponse.json({ stay: updated });
    }

    const toStatus = actionToStatus(input.action);

    const updated = await transitionStayStatus({
      propertyId: activePropertyId,
      reservationId: id,
      toStatus,
    });

    return NextResponse.json({ stay: updated });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
