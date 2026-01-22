import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import { createStay } from "@/lib/pms/stays";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  status: z
    .enum(["HOLD", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
    .optional(),
});

const createSchema = z.object({
  roomId: z.string().min(1),
  startDate: dateOnly,
  endDate: dateOnly,
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().optional(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  notes: z.string().trim().max(500).optional(),
  source: z.enum(["MANUAL", "DIRECT"]).default("MANUAL"),
});

export async function GET(req: Request) {
  try {
    const { activePropertyId } = await requireActivePropertyScope();

    const url = new URL(req.url);
    const q = listQuerySchema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    const stays = await prisma.reservation.findMany({
      where: {
        propertyId: activePropertyId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.from && q.to
          ? {
              stays: {
                some: {
                  startDate: { lt: new Date(`${q.to}T00:00:00.000Z`) },
                  endDate: { gt: new Date(`${q.from}T00:00:00.000Z`) },
                },
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        guestName: true,
        guestEmail: true,
        channel: true,
        createdAt: true,
        stays: {
          take: 1,
          select: {
            startDate: true,
            endDate: true,
            room: { select: { id: true, name: true } },
          },
        },
      } as any,
    });

    return NextResponse.json({
      stays: stays.map((s) => {
        const sAny = s as any;
        const stayRow = sAny.stays?.[0];
        const publicStatus = sAny.status === "HOLD" ? "DRAFT" : sAny.status;
        return {
          id: sAny.id,
          status: publicStatus,
          paymentStatus: sAny.paymentStatus,
          guestName: sAny.guestName,
          guestEmail: sAny.guestEmail,
          channel: sAny.channel,
          startDate: stayRow?.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: stayRow?.endDate?.toISOString().slice(0, 10) ?? null,
          room: stayRow?.room ?? null,
          createdAt: sAny.createdAt,
        };
      }),
    });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { activePropertyId, role, user } = await requireActivePropertyScope();
    if (!( ["OWNER", "MANAGER"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const input = createSchema.parse(body);

    const stay = await createStay({
      propertyId: activePropertyId,
      createdByUserId: user.id,
      roomId: input.roomId,
      startDate: input.startDate,
      endDate: input.endDate,
      guestName: input.guestName,
      guestEmail: input.guestEmail ?? null,
      adults: input.adults,
      children: input.children,
      notes: input.notes ?? null,
      source: input.source,
    });

    return NextResponse.json({ stay }, { status: 201 });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
