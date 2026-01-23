import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import { parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const patchSchema = z.object({
  startDate: dateOnly,
  endDate: dateOnly,
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!( ["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const input = patchSchema.parse(body);

    const start = parseDateOnlyToUtcMidnight(input.startDate);
    const end = parseDateOnlyToUtcMidnight(input.endDate);
    if (!(end > start)) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const existing = await prisma.block.findFirst({
      where: { id, propertyId: activePropertyId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const block = await prisma.block.update({
      where: { id },
      data: { startDate: start, endDate: end },
      select: {
        id: true,
        roomId: true,
        startDate: true,
        endDate: true,
        reason: true,
      },
    });

    return NextResponse.json(
      {
        block: {
          id: block.id,
          roomId: block.roomId,
          startDate: block.startDate.toISOString().slice(0, 10),
          endDate: block.endDate.toISOString().slice(0, 10),
          reason: block.reason,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
