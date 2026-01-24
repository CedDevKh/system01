import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActivePropertyScope } from "@/lib/propertyScope";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

function dollarsToCents(input: string) {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

export default async function RoomTypesPage() {
  const { activePropertyId, role } = await requireActivePropertyScope();

  const property = await prisma.property.findUnique({
    where: { id: activePropertyId },
    select: { currency: true },
  });

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: activePropertyId },
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

  type RoomTypeRow = (typeof roomTypes)[number];

  const canWrite = role === "OWNER" || role === "MANAGER";

  async function createRoomType(formData: FormData) {
    "use server";
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(role === "OWNER" || role === "MANAGER")) return;

    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const defaultOccupancy = Number(formData.get("defaultOccupancy") ?? 2);
    const baseRateRaw = String(formData.get("baseRate") ?? "").trim();

    if (!code || !name) return;

    const baseRateCents = baseRateRaw ? dollarsToCents(baseRateRaw) : 0;
    if (baseRateCents === null || baseRateCents < 0) return;

    await prisma.roomType.create({
      data: {
        propertyId: activePropertyId,
        code,
        name,
        defaultOccupancy: Number.isFinite(defaultOccupancy) ? defaultOccupancy : 2,
        baseRateCents,
      },
    });

    revalidatePath("/pms/room-types");
    revalidatePath("/pms/rooms");
    revalidatePath("/pms/availability");
    revalidatePath("/pms/rates");
    revalidatePath("/pms/stays");
    revalidatePath("/pms/stays/new");
    redirect("/pms/room-types");
  }

  async function updateBaseRate(roomTypeId: string, formData: FormData) {
    "use server";
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(role === "OWNER" || role === "MANAGER")) return;

    const baseRateRaw = String(formData.get("baseRate") ?? "").trim();
    const baseRateCents = baseRateRaw ? dollarsToCents(baseRateRaw) : 0;
    if (baseRateCents === null || baseRateCents < 0) return;

    await prisma.roomType.updateMany({
      where: { id: roomTypeId, propertyId: activePropertyId },
      data: { baseRateCents },
    });

    revalidatePath("/pms/room-types");
    revalidatePath("/pms/rates");
    revalidatePath("/pms/availability");
    redirect("/pms/room-types");
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Room types"
        subtitle="Define sellable room categories and pricing bases."
        actions={
          <Button variant="ghost" href="/pms/rooms">
            Rooms →
          </Button>
        }
      />

      {canWrite && (
        <Card>
          <CardContent>
            <form action={createRoomType} className="max-w-3xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Code</label>
                  <input
                    name="code"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    placeholder="STD"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Name</label>
                  <input
                    name="name"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    placeholder="Standard"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Default occ.</label>
                  <input
                    name="defaultOccupancy"
                    type="number"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    defaultValue={2}
                    min={1}
                    max={20}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Base rate</label>
                  <input
                    name="baseRate"
                    type="number"
                    step="0.01"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="primary" type="submit">
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Default occ.</th>
                <th className="py-3 px-4">Base rate</th>
                <th className="py-3 px-4">Active</th>
                {canWrite ? <th className="py-3 px-4"></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roomTypes.map((rt: RoomTypeRow) => (
                <tr key={rt.id} className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-sm align-middle">{rt.code}</td>
                  <td className="py-3 px-4 text-sm align-middle">
                    <span className="font-medium text-foreground">{rt.name}</span>
                  </td>
                  <td className="py-3 px-4 text-sm align-middle">{rt.defaultOccupancy}</td>
                  <td className="py-3 px-4 text-sm align-middle whitespace-nowrap">
                    {property
                      ? `${property.currency} ${(rt.baseRateCents / 100).toFixed(2)}`
                      : (rt.baseRateCents / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-sm align-middle">{rt.isActive ? "Yes" : "No"}</td>
                  {canWrite ? (
                    <td className="py-3 px-4 text-sm align-middle whitespace-nowrap text-right">
                      <form
                        action={updateBaseRate.bind(null, rt.id)}
                        className="flex gap-2 items-end justify-end"
                      >
                        <input
                          name="baseRate"
                          type="number"
                          step="0.01"
                          className="border px-2 py-1 w-28"
                          defaultValue={(rt.baseRateCents / 100).toFixed(2)}
                        />
                        <Button variant="secondary" type="submit" className="px-3 py-1">
                          Save
                        </Button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
