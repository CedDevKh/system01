import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["ACTIVE", "OUT_OF_ORDER"]).optional(),
    roomTypeId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields" });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const input = patchSchema.parse(body);

    const existing = await prisma.room.findFirst({
      where: { id, propertyId: activePropertyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (input.roomTypeId) {
      const rt = await prisma.roomType.findFirst({
        where: { id: input.roomTypeId, propertyId: activePropertyId, isActive: true },
        select: { id: true },
      });
      if (!rt) {
        return NextResponse.json({ error: "Invalid roomTypeId" }, { status: 400 });
      }
    }

    const room = await prisma.room.update({
      where: { id },
      data: input,
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        roomType: { select: { id: true, code: true, name: true } },
      },
    });

    revalidatePath("/pms/rooms");
    revalidatePath("/pms/availability");
    revalidatePath("/pms/housekeeping");
    revalidatePath("/dashboard");

    return NextResponse.json({ room });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
