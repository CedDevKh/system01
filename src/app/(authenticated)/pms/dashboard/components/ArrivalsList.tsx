"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData, StayStatus } from "../actions";

type Row = DashboardData["lists"]["arrivals"][number];

function statusVariant(status: StayStatus) {
  if (status === "CHECKED_IN") return "success" as const;
  if (status === "CONFIRMED") return "info" as const;
  if (status === "DRAFT") return "neutral" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "NO_SHOW") return "warning" as const;
  return "neutral" as const;
}

export function ArrivalsList(props: { rows: Row[]; title?: string }) {
  return (
    <Card className="h-full">
      <CardHeader className="py-2">
        <CardTitle>{props.title ?? "Arrivals"}</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {props.rows.length === 0 ? (
          <div className="text-sm text-slate-600">No arrivals.</div>
        ) : (
          <div className="space-y-2">
            {props.rows.map((r) => (
              <div
                key={r.stayId}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {r.guestName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {r.roomTypeName} • {r.roomName ?? "Unassigned"}
                    {r.source ? ` • ${r.source}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  <Link className="text-blue-600 hover:underline text-sm" href={`/pms/stays/${r.stayId}`}>
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
