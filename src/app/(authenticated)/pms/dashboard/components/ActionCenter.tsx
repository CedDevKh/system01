"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardActionItem } from "../actions";

export function ActionCenter(props: {
  items: DashboardActionItem[];
  canManage: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="py-2">
        <CardTitle>Action Center</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {props.items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No urgent tasks right now.</div>
        ) : (
          <div className="space-y-2">
            {props.items.map((item) => {
              const primaryDisabled = item.requiresManagePermission && !props.canManage;

              return (
                <div
                  key={item.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="text-sm font-medium text-foreground">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      href={item.href}
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                    >
                      Open
                    </Button>
                    {item.primaryActionHref && item.primaryActionLabel ? (
                      <Button
                        href={item.primaryActionHref}
                        variant="primary"
                        className="px-3 py-1.5 text-xs"
                        disabled={primaryDisabled}
                        title={
                          primaryDisabled
                            ? "Requires manager/owner permission"
                            : undefined
                        }
                      >
                        {item.primaryActionLabel}
                      </Button>
                    ) : null}
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
