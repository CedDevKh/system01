"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData, StayStatus } from "../actions";

type Row = DashboardData["lists"]["inHouse"][number];

type SortKey = "room" | "guest" | "checkout" | "status";

type SortDir = "asc" | "desc";

function statusVariant(status: StayStatus) {
  if (status === "CHECKED_IN") return "success" as const;
  if (status === "CONFIRMED") return "info" as const;
  if (status === "DRAFT") return "neutral" as const;
  if (status === "CHECKED_OUT") return "neutral" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "NO_SHOW") return "warning" as const;
  return "neutral" as const;
}

function compare(a: Row, b: Row, key: SortKey) {
  if (key === "room") return (a.roomName ?? "").localeCompare(b.roomName ?? "");
  if (key === "guest") return a.guestName.localeCompare(b.guestName);
  if (key === "checkout") return a.checkoutDateKey.localeCompare(b.checkoutDateKey);
  return a.status.localeCompare(b.status);
}

export function InHouseTable(props: { rows: Row[]; canManage: boolean }) {
  const [sortKey, setSortKey] = React.useState<SortKey>("checkout");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const rows = React.useMemo(() => {
    const copy = [...props.rows];
    copy.sort((a, b) => {
      const c = compare(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });
    return copy;
  }, [props.rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="py-2">
        <CardTitle>In-house</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-600">No in-house stays.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2">
                    <button
                      className="hover:underline"
                      onClick={() => toggleSort("room")}
                      type="button"
                    >
                      Room
                    </button>
                  </th>
                  <th className="py-2 pr-2">
                    <button
                      className="hover:underline"
                      onClick={() => toggleSort("guest")}
                      type="button"
                    >
                      Guest
                    </button>
                  </th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">
                    <button
                      className="hover:underline"
                      onClick={() => toggleSort("checkout")}
                      type="button"
                    >
                      Checkout
                    </button>
                  </th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.stayId} className="border-b border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {r.roomName ?? "—"}
                      <div className="text-xs text-slate-500">{r.roomTypeName}</div>
                    </td>
                    <td className="py-2 pr-2 font-medium text-slate-900">
                      {r.guestName}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">{r.checkoutDateKey}</td>
                    <td className="py-2 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Link className="text-blue-600 hover:underline" href={`/pms/stays/${r.stayId}`}>
                          View
                        </Link>
                        <Button
                          href={`/pms/stays/${r.stayId}?action=checkout`}
                          variant="primary"
                          className="px-3 py-1.5 text-xs"
                          disabled={!props.canManage}
                          title={
                            !props.canManage
                              ? "Requires manager/owner permission"
                              : undefined
                          }
                        >
                          Check-out
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
