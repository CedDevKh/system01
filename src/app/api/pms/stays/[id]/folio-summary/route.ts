import { NextResponse } from "next/server";

import { requireActivePropertyScope } from "@/lib/propertyScope";
import { asRouteErrorResponse } from "@/app/api/pms/_errors";
import { getFolioSummary } from "@/lib/pms/stays";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { activePropertyId } = await requireActivePropertyScope();
    const { id } = await ctx.params;

    const summary = await getFolioSummary({
      propertyId: activePropertyId,
      reservationId: id,
    });

    return NextResponse.json({ summary });
  } catch (err) {
    return asRouteErrorResponse(err);
  }
}
