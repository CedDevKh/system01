import { getActivePropertyContext, canManageStays, canViewStays } from "@/lib/propertyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

import { getDashboardData, resolveRangeMode } from "../pms/dashboard/actions";
import { ActionCenter } from "../pms/dashboard/components/ActionCenter";
import { InHouseTable } from "../pms/dashboard/components/InHouseTable";
import { ArrivalsList } from "../pms/dashboard/components/ArrivalsList";
import { DeparturesList } from "../pms/dashboard/components/DeparturesList";
import { HousekeepingSummary } from "../pms/dashboard/components/HousekeepingSummary";
import { AvailabilitySnapshot } from "../pms/dashboard/components/AvailabilitySnapshot";

export const dynamic = "force-dynamic";

function KpiCard(props: { label: string; value: string; helper?: string }) {
  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="text-xs text-slate-500 font-medium">{props.label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-3">
        <div className="text-2xl font-semibold text-slate-900">{props.value}</div>
        {props.helper ? (
          <div className="mt-1 text-xs text-slate-500">{props.helper}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { property, membership } = await getActivePropertyContext();
  if (!canViewStays(membership)) {
    return (
      <main className="p-6">
        <PageHeader title="Dashboard" />
        <p className="text-sm text-black/70">No access.</p>
      </main>
    );
  }

  const sp = (await searchParams) ?? {};
  const modeParam = typeof sp.rangeMode === "string" ? sp.rangeMode : undefined;
  const rangeMode = resolveRangeMode(modeParam);
  const canManage = canManageStays(membership);

  const data = await getDashboardData({ propertyId: property.id, rangeMode });

  const rangeToggle = (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
      <Button
        href={`/dashboard?rangeMode=today`}
        variant={rangeMode === "today" ? "secondary" : "ghost"}
        className="px-3 py-1.5 text-xs"
      >
        Today
      </Button>
      <Button
        href={`/dashboard?rangeMode=tomorrow`}
        variant={rangeMode === "tomorrow" ? "secondary" : "ghost"}
        className="px-3 py-1.5 text-xs"
      >
        Tomorrow
      </Button>
      <Button
        href={`/dashboard?rangeMode=next7`}
        variant={rangeMode === "next7" ? "secondary" : "ghost"}
        className="px-3 py-1.5 text-xs"
      >
        Next 7 days
      </Button>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your property performance."
        actions={
          <>
            {rangeToggle}
            <Button variant="primary" href="/pms/stays/new">
              New reservation
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Arrivals"
          value={`${data.kpis.arrivalsCount}`}
          helper={`${data.range.startDateKey} → ${data.range.endDateKeyExclusive}`}
        />
        <KpiCard label="Departures" value={`${data.kpis.departuresCount}`} />
        <KpiCard label="In-house" value={`${data.kpis.inHouseCount}`} />
        <KpiCard
          label="Occupancy"
          value={
            data.kpis.occupancy.total === 0
              ? "N/A"
              : `${data.kpis.occupancy.sold}/${data.kpis.occupancy.total} (${data.kpis.occupancy.pct ?? 0}%)`
          }
          helper="Night-based (checkout exclusive)"
        />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ActionCenter items={data.actionCenter} canManage={canManage} />
        </div>
        <div className="lg:col-span-8">
          <InHouseTable rows={data.lists.inHouse} canManage={canManage} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ArrivalsList
            title={
              rangeMode === "today"
                ? "Arrivals today"
                : rangeMode === "tomorrow"
                  ? "Arrivals tomorrow"
                  : "Arrivals (next 7 days)"
            }
            rows={data.lists.arrivals}
          />
        </div>
        <div className="lg:col-span-4">
          <DeparturesList
            title={
              rangeMode === "today"
                ? "Departures today"
                : rangeMode === "tomorrow"
                  ? "Departures tomorrow"
                  : "Departures (next 7 days)"
            }
            rows={data.lists.departures}
          />
        </div>
        <div className="lg:col-span-4">
          <HousekeepingSummary
            dirtyCount={data.housekeepingSummary.dirtyCount}
            cleanCount={data.housekeepingSummary.cleanCount}
            needsInspectionCount={data.housekeepingSummary.needsInspectionCount}
            arrivalsNotCleanCount={data.housekeepingSummary.arrivalsNotCleanCount}
            canManage={canManage}
          />
        </div>
      </section>

      <section>
        <AvailabilitySnapshot rows={data.availabilitySnapshot.byRoomType} />
      </section>
    </main>
  );
}
