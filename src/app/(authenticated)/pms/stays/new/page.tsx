import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

import NewReservationClient from "./NewReservationClient";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const { property, membership } = await getActivePropertyContext();

  if (!canManageStays(membership)) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <PageHeader title="New reservation" />
        <p className="text-sm text-black/70">Not authorized.</p>
        <div className="mt-4">
          <Button variant="ghost" href="/pms/stays">
            Back to stays
          </Button>
        </div>
      </main>
    );
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id, isActive: true },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true },
  });

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <PageHeader
        title="New reservation"
        subtitle={property.name}
        actions={
          <Button variant="ghost" href="/pms/stays">
            ← Stays
          </Button>
        }
      />

      <NewReservationClient roomTypes={roomTypes} />
    </main>
  );
}
