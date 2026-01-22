import { prisma } from "@/lib/prisma";
import { canViewStays, getActivePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim();
}

function buildSearchWhere(q: string) {
  const tokens = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (tokens.length === 0) return null;

  return {
    AND: tokens.map((token) => ({
      OR: [
        { firstName: { contains: token, mode: "insensitive" as const } },
        { lastName: { contains: token, mode: "insensitive" as const } },
        { email: { contains: token, mode: "insensitive" as const } },
        { phone: { contains: token, mode: "insensitive" as const } },
      ],
    })),
  };
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();
  if (!canViewStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Guests" />
        <p className="text-sm text-black/70">No access.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const q = normalizeQuery(typeof sp.q === "string" ? sp.q : "");
  const searchWhere = q ? buildSearchWhere(q) : null;

  const guests = await prisma.guest.findMany({
    where: {
      propertyId: property.id,
      ...(searchWhere ? searchWhere : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const emptyMessage = q
    ? `No guests found for “${q}”.`
    : "No guests yet.";

  return (
    <main className="p-6 space-y-6">
      <PageHeader title="Guests" subtitle={property.name} />

      <Card>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-sm">Search</label>
              <input
                name="q"
                className="border px-2 py-1 w-80 max-w-full"
                placeholder="Name, email, phone"
                defaultValue={q}
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q ? (
              <Button variant="ghost" href="/pms/guests" className="px-2 py-1 text-sm">
                Clear
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
        {guests.length === 0 ? (
          <div className="p-4 text-sm text-black/70">{emptyMessage}</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Phone</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => {
                const name = `${g.firstName} ${g.lastName}`.trim();
                return (
                  <tr key={g.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium">{name || "—"}</td>
                    <td className="py-2 px-3 text-sm text-black/70">{g.email ?? ""}</td>
                    <td className="py-2 px-3 text-sm text-black/70">{g.phone ?? ""}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Button href={`/pms/guests/${g.id}`} variant="ghost" className="px-2 py-1">
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </CardContent>
      </Card>
    </main>
  );
}
