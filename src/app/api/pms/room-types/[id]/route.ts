import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";

const patchSchema = z
  .object({
    code: z.string().trim().min(1).max(20).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    defaultOccupancy: z.coerce.number().int().min(1).max(20).optional(),
    baseRateCents: z.coerce.number().int().min(0).optional(),
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

    const existing = await prisma.roomType.findFirst({
      where: { id, propertyId: activePropertyId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const roomType = await prisma.roomType.update({
      where: { id },
      data: input,
      select: {
        id: true,
        code: true,
        name: true,
        defaultOccupancy: true,
        baseRateCents: true,
        isActive: true,
      },
    });

    revalidatePath("/pms/room-types");
    revalidatePath("/pms/rooms");
    revalidatePath("/pms/availability");
    revalidatePath("/pms/rates");
    revalidatePath("/pms/stays");
    revalidatePath("/pms/stays/new");

    return NextResponse.json({ roomType });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
