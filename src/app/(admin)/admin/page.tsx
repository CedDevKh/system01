import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

import { getAdminDashboardData } from "./adminDashboardData";

export default async function AdminPage() {
  const data = await getAdminDashboardData();
  const dateFmt = new Intl.DateTimeFormat("en-GB");

  const rows = data.recentDemoRequests.map((r) => {
    const name = `${r.firstName}${r.lastName ? ` ${r.lastName}` : ""}`;
    return {
      ...r,
      name,
      requested: dateFmt.format(r.createdAt),
      property: r.propertyName ?? "-",
      country: r.country ?? "-",
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Unified Ops – Admin Dashboard"
        subtitle={`Hi, ${data.superAdminEmail}. Here’s an overview of the platform.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Total properties</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {data.totalProperties}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Total users</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{data.totalUsers}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Demo requests</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
              {data.totalDemoRequests}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="text-sm font-semibold text-foreground">Latest demo requests</div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-background p-6 text-sm text-muted-foreground">
            No demo requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-left">Country</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-4 py-3 text-foreground">{r.email}</td>
                    <td className="px-4 py-3 text-foreground">{r.property}</td>
                    <td className="px-4 py-3 text-foreground">{r.country}</td>
                    <td className="px-4 py-3 text-foreground">{r.requested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
