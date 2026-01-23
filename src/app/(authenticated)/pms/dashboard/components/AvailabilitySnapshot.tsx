"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AvailabilitySnapshot(props: {
  rows: Array<{
    roomTypeId: string;
    roomTypeName: string;
    available: number;
    total: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle>Availability snapshot</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {props.rows.length === 0 ? (
          <div className="text-sm text-slate-600">No room types.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {props.rows.map((r) => {
              const pct = r.total > 0 ? Math.round((r.available / r.total) * 100) : 0;
              return (
                <div
                  key={r.roomTypeId}
                  className="rounded-md border border-slate-100 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">
                      {r.roomTypeName}
                    </div>
                    <div className="text-sm text-slate-700">
                      {r.available}/{r.total}
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-slate-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
