import { prisma } from "@/lib/prisma";
import { canManageStays, getActivePropertyContext } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  createRatePlan,
  setDefaultRatePlan,
  updateRatePlanRoomTypeRates,
} from "./actions";

export const dynamic = "force-dynamic";

function centsToMoneyInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();

  if (!canManageStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Rates" />
        <p className="text-sm text-black/70">Not authorized.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const planIdParam = typeof sp.planId === "string" ? sp.planId : "";

  const [ratePlans, roomTypes] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: {
        roomTypeRates: {
          include: {
            roomType: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
    prisma.roomType.findMany({
      where: { propertyId: property.id, isActive: true },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        baseRateCents: true,
      },
    }),
  ]);

  const selectedPlan =
    ratePlans.find((p) => p.id === planIdParam) ??
    ratePlans.find((p) => p.isDefault) ??
    ratePlans[0] ??
    null;

  const ratesByRoomTypeId = new Map<string, number>();
  if (selectedPlan) {
    for (const r of selectedPlan.roomTypeRates) {
      ratesByRoomTypeId.set(r.roomTypeId, r.nightlyRateCents);
    }
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader
        title="Rates"
        subtitle={property.name}
        actions={
          <Button variant="ghost" href="/pms/stays">
            ← Stays
          </Button>
        }
      />

      <div className="text-sm text-black/70">Currency: {property.currency}</div>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">Add rate plan</div>

          <form action={createRatePlan} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-sm">Name</label>
              <input name="name" className="border px-2 py-1" placeholder="Standard" required />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Code</label>
              <input name="code" className="border px-2 py-1 w-28" placeholder="STD" required />
            </div>
            <div className="flex flex-col grow min-w-[240px]">
              <label className="text-sm">Description</label>
              <input name="description" className="border px-2 py-1" placeholder="Optional" />
            </div>
            <Button variant="secondary" type="submit">
              Add rate plan
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Rate plans</h2>
        <Card>
          <CardContent className="p-0">
          {ratePlans.length === 0 ? (
            <div className="p-4 text-sm text-black/70">No rate plans yet.</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Default</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {ratePlans.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3">
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-sm text-black/60">{p.description}</div>
                      ) : null}
                    </td>
                    <td className="py-2 px-3 font-mono text-sm">{p.code}</td>
                    <td className="py-2 px-3">
                      {p.isDefault ? (
                        <span className="inline-flex items-center rounded-full border border-black/10 px-2 py-0.5 text-xs">
                          Default
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-3">
                        {!p.isDefault ? (
                          <form action={setDefaultRatePlan.bind(null, p.id)}>
                            <Button variant="secondary" type="submit" className="px-3 py-1 text-sm">
                              Set as default
                            </Button>
                          </form>
                        ) : null}
                        <Button
                          variant="ghost"
                          href={`/pms/rates?planId=${p.id}#rates`}
                          className="px-2 py-1 text-sm"
                        >
                          Edit rates
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </CardContent>
        </Card>
      </section>

      <section id="rates" className="space-y-3">
        <h2 className="text-xl font-semibold">Rates</h2>

        {!selectedPlan ? (
          <Card>
            <CardContent className="text-sm text-black/70">
              Create a rate plan to manage nightly rates.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-semibold">
                  {selectedPlan.name} ({selectedPlan.code})
                </div>
                <div className="text-sm text-black/60">Edit flat nightly rates per room type.</div>
              </div>

              <form action={updateRatePlanRoomTypeRates} className="space-y-3">
                <input type="hidden" name="ratePlanId" value={selectedPlan.id} />

                <div className="rounded-md border border-black/10 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left border-b bg-black/[0.02]">
                        <th className="py-2 px-3">Room type</th>
                        <th className="py-2 px-3">Nightly rate ({property.currency})</th>
                        <th className="py-2 px-3">Legacy base rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomTypes.map((rt) => {
                        const existing = ratesByRoomTypeId.get(rt.id) ?? 0;
                        return (
                          <tr key={rt.id} className="border-b last:border-b-0">
                            <td className="py-2 px-3">
                              <div className="font-medium">
                                {rt.code} — {rt.name}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                name={`rates[${rt.id}]`}
                                className="border px-2 py-1 w-40"
                                defaultValue={centsToMoneyInput(existing)}
                                inputMode="decimal"
                              />
                            </td>
                            <td className="py-2 px-3 text-sm text-black/60">
                              {rt.baseRateCents ? centsToMoneyInput(rt.baseRateCents) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Button variant="secondary" type="submit">
                  Save rates
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
