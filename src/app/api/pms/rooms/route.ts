import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(100),
  roomTypeId: z.string().min(1),
});

export async function GET() {
  try {
    const { activePropertyId } = await requireActivePropertyScope();

    const rooms = await prisma.room.findMany({
      where: { propertyId: activePropertyId, isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        roomType: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json(
      { rooms },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const input = createRoomSchema.parse(body);

    const roomType = await prisma.roomType.findFirst({
      where: { id: input.roomTypeId, propertyId: activePropertyId, isActive: true },
      select: { id: true },
    });

    if (!roomType) {
      return NextResponse.json({ error: "Invalid roomTypeId" }, { status: 400 });
    }

    const room = await prisma.room.create({
      data: {
        propertyId: activePropertyId,
        name: input.name,
        roomTypeId: input.roomTypeId,
      },
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

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
