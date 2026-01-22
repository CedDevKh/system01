import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import { parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

const createBlockSchema = z.object({
  roomId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    if (!(["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const input = createBlockSchema.parse(body);

    const start = parseDateOnlyToUtcMidnight(input.startDate);
    const end = parseDateOnlyToUtcMidnight(input.endDate);

    if (!(end > start)) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const room = await prisma.room.findFirst({
      where: { id: input.roomId, propertyId: activePropertyId, isActive: true },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }

    const block = await prisma.block.create({
      data: {
        propertyId: activePropertyId,
        roomId: input.roomId,
        startDate: start,
        endDate: end,
        reason: input.reason,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        roomId: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
