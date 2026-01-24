import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const { activePropertyId, role } = await requireActivePropertyScope();
  const canWrite = role === "OWNER" || role === "MANAGER";

  const [roomTypes, rooms] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: activePropertyId, isActive: true },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.room.findMany({
      where: { propertyId: activePropertyId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        roomType: { select: { code: true, name: true } },
      },
    }),
  ]);

  type RoomTypeRow = (typeof roomTypes)[number];
  type RoomRow = (typeof rooms)[number];

  async function createRoom(formData: FormData) {
    "use server";
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(role === "OWNER" || role === "MANAGER")) return;

    const name = String(formData.get("name") ?? "").trim();
    const roomTypeId = String(formData.get("roomTypeId") ?? "").trim();
    if (!name || !roomTypeId) return;

    const rt = await prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: activePropertyId, isActive: true },
      select: { id: true },
    });
    if (!rt) return;

    await prisma.room.create({
      data: {
        propertyId: activePropertyId,
        name,
        roomTypeId,
      },
    });

    revalidatePath("/pms/rooms");
    revalidatePath("/pms/availability");
    revalidatePath("/pms/housekeeping");
    revalidatePath("/pms/stays");
    revalidatePath("/dashboard");
    redirect("/pms/rooms");
  }

  async function toggleOutOfOrder(formData: FormData) {
    "use server";
    const { activePropertyId, role } = await requireActivePropertyScope();
    if (!(role === "OWNER" || role === "MANAGER")) return;

    const roomId = String(formData.get("roomId") ?? "");
    const current = String(formData.get("current") ?? "ACTIVE");

    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId: activePropertyId },
      select: { id: true, status: true },
    });
    if (!room) return;

    const next = current === "OUT_OF_ORDER" ? "ACTIVE" : "OUT_OF_ORDER";
    await prisma.room.update({
      where: { id: roomId },
      data: { status: next },
    });

    revalidatePath("/pms/rooms");
    revalidatePath("/pms/availability");
    revalidatePath("/pms/housekeeping");
    revalidatePath("/dashboard");
    redirect("/pms/rooms");
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Rooms"
        subtitle="Manage physical rooms for this property."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" href="/pms/room-types">
              ← Room types
            </Button>
            <Button variant="ghost" href="/pms/stays">
              Stays
            </Button>
            <Button variant="ghost" href="/pms/availability">
              Availability →
            </Button>
          </div>
        }
      />

      {canWrite && (
        <Card>
          <CardContent>
            <form action={createRoom} className="max-w-3xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Name</label>
                  <input
                    name="name"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    placeholder="101"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Room type</label>
                  <select
                    name="roomTypeId"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    required
                  >
                    <option value="">Select…</option>
                    {roomTypes.map((rt: RoomTypeRow) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.code} — {rt.name}
                      </option>
                    ))}
                  </select>
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
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooms.map((r: RoomRow) => (
                <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 text-sm align-middle">
                    <span className="font-medium text-foreground">{r.name}</span>
                  </td>
                  <td className="py-3 px-4 text-sm align-middle">
                    {r.roomType.code} — {r.roomType.name}
                  </td>
                  <td className="py-3 px-4 text-sm align-middle">{r.status}</td>
                  <td className="py-3 px-4 text-sm align-middle">{r.isActive ? "Yes" : "No"}</td>
                  <td className="py-3 px-4 text-sm align-middle text-right whitespace-nowrap">
                    {canWrite && (
                      <form action={toggleOutOfOrder}>
                        <input type="hidden" name="roomId" value={r.id} />
                        <input type="hidden" name="current" value={r.status} />
                        <Button variant="secondary" type="submit" className="px-3 py-1">
                          {r.status === "OUT_OF_ORDER" ? "Set Active" : "Set Out of order"}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
