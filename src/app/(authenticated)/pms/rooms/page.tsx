import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

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
            <form action={createRoom} className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-sm">Name</label>
                <input name="name" className="border px-2 py-1" placeholder="101" required />
              </div>
              <div className="flex flex-col">
                <label className="text-sm">Room type</label>
                <select name="roomTypeId" className="border px-2 py-1" required>
                  <option value="">Select…</option>
                  {roomTypes.map((rt: RoomTypeRow) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.code} — {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" type="submit">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Status</th>
                <th className="py-2">Active</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r: RoomRow) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">
                    {r.roomType.code} — {r.roomType.name}
                  </td>
                  <td className="py-2">{r.status}</td>
                  <td className="py-2">{r.isActive ? "Yes" : "No"}</td>
                  <td className="py-2 text-right">
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
