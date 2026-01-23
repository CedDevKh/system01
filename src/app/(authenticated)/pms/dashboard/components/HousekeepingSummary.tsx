"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HousekeepingSummary(props: {
  dirtyCount: number;
  cleanCount: number;
  needsInspectionCount: number;
  arrivalsNotCleanCount: number;
  canManage: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="py-2">
        <CardTitle>Housekeeping</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-slate-100 p-2">
            <div className="text-xs text-slate-500">Dirty</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {props.dirtyCount}
            </div>
          </div>
          <div className="rounded-md border border-slate-100 p-2">
            <div className="text-xs text-slate-500">Clean</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {props.cleanCount}
            </div>
          </div>
          <div className="rounded-md border border-slate-100 p-2">
            <div className="text-xs text-slate-500">Needs inspection</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {props.needsInspectionCount}
            </div>
          </div>
          <div className="rounded-md border border-slate-100 p-2">
            <div className="text-xs text-slate-500">Arrivals not clean</div>
            <div
              className={
                "mt-1 text-lg font-semibold " +
                (props.arrivalsNotCleanCount > 0 ? "text-red-700" : "text-slate-900")
              }
            >
              {props.arrivalsNotCleanCount}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Button
            href="/pms/housekeeping"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
          >
            Open housekeeping
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
