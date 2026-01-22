import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";

const createRoomTypeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  defaultOccupancy: z.coerce.number().int().min(1).max(20).default(2),
  baseRateCents: z.coerce.number().int().min(0).default(0),
});

export async function GET() {
  try {
    const { activePropertyId } = await requireActivePropertyScope();

    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId: activePropertyId, isActive: true },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        defaultOccupancy: true,
        baseRateCents: true,
        isActive: true,
      },
    });

    return NextResponse.json(
      { roomTypes },
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
    const input = createRoomTypeSchema.parse(body);

    const roomType = await prisma.roomType.create({
      data: {
        propertyId: activePropertyId,
        code: input.code,
        name: input.name,
        defaultOccupancy: input.defaultOccupancy,
        baseRateCents: input.baseRateCents,
      },
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

    return NextResponse.json({ roomType }, { status: 201 });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
