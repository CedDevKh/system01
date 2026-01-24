import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePropertyIdForRequest } from "@/lib/property-context/activeProperty";
import { selectProperty } from "@/app/actions/activeProperty";

type Membership = {
  property: { id: string; name: string };
  role: string;
};

export default async function SelectPropertyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const userId = (session.user as any).id as string;

  const activePropertyId = await getActivePropertyIdForRequest();
  if (activePropertyId) {
    redirect("/dashboard");
  }

  const memberships = (await prisma.propertyUser.findMany({
    where: {
      userId,
      property: { isActive: true },
    },
    select: {
      property: { select: { id: true, name: true } },
      role: true,
    },
    orderBy: {
      property: { name: "asc" },
    },
  })) as Membership[];

  if (memberships.length === 0) {
    redirect("/setup/property");
  }

  return (
    <main className="p-6">
      <h1 className="text-lg font-semibold">Select property</h1>
      <p className="mt-2 mb-4 text-sm text-black/70">
        Choose the active property for this session.
      </p>

      <form action={selectProperty}>
        <div className="grid gap-2 max-w-lg">
          {memberships.map((m: Membership) => (
            <button
              key={m.property.id}
              type="submit"
              name="propertyId"
              value={m.property.id}
              className="text-left rounded-lg border border-black/10 bg-white p-3 hover:bg-black/[0.02]"
            >
              <div className="font-semibold">{m.property.name}</div>
              <div className="text-xs text-black/70">Role: {m.role}</div>
            </button>
          ))}
        </div>
      </form>
    </main>
  );
}

