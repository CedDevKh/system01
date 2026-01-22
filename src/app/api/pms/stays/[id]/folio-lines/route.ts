import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import { addFolioLine, reverseFolioLine } from "@/lib/pms/stays";

const postSchema = z.union([
  z.object({
    type: z.enum(["CHARGE", "PAYMENT"]),
    amountCents: z.coerce.number().int().positive(),
    description: z.string().trim().max(200).optional(),
  }),
  z.object({
    reverseLineId: z.string().min(1),
  }),
]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId } = await requireActivePropertyScope();
    const { id } = await ctx.params;

    const folio = await prisma.folio.findUnique({
      where: { reservationId: id },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json({ error: "Folio not found" }, { status: 404 });
    }

    const lines = await prisma.folioLine.findMany({
      where: { propertyId: activePropertyId, folioId: folio.id },
      orderBy: [{ postedAt: "asc" }],
      select: {
        id: true,
        type: true,
        amountCents: true,
        currency: true,
        description: true,
        postedAt: true,
        reversalOfLineId: true,
      },
    });

    return NextResponse.json({ lines });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    const { id } = await ctx.params;

    const body = await req.json();
    const input = postSchema.parse(body);

    if ("reverseLineId" in input) {
      if (!(["OWNER", "MANAGER"] as const).includes(role as any)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const line = await reverseFolioLine({
        propertyId: activePropertyId,
        reservationId: id,
        createdByUserId: user.id,
        lineId: input.reverseLineId,
      });
      return NextResponse.json({ line }, { status: 201 });
    }

    if (input.type === "PAYMENT" && !(["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!(["OWNER", "MANAGER", "RECEPTIONIST"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const line = await addFolioLine({
      propertyId: activePropertyId,
      reservationId: id,
      createdByUserId: user.id,
      type: input.type,
      amountCents: input.amountCents,
      description: input.description ?? null,
    });

    return NextResponse.json({ line }, { status: 201 });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
