"use client";

import * as React from "react";

import type { RoomStatusFilter, ViewDays } from "./types";
import { Button } from "@/components/ui/button";

type PropertyOption = {
  id: string;
  name: string;
};

type Props = {
  currentProperty: PropertyOption;
  availableProperties: PropertyOption[];

  from: string;
  to: string;
  viewDays: ViewDays;

  roomTypeId: string | null;
  roomTypeOptions: Array<{ id: string; name: string }>;

  roomStatusFilter: RoomStatusFilter;

  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSetViewDays: (days: ViewDays) => void;
  onSetRoomTypeId: (roomTypeId: string | null) => void;
  onSetRoomStatusFilter: (filter: RoomStatusFilter) => void;

  canManageReservations: boolean;
  onNewReservation: () => void;
};

function viewBtnVariant(active: boolean) {
  return active ? ("secondary" as const) : ("ghost" as const);
}

export function AvailabilityToolbar({
  currentProperty,
  availableProperties,
  from,
  to,
  viewDays,
  roomTypeId,
  roomTypeOptions,
  roomStatusFilter,
  onPrev,
  onNext,
  onToday,
  onSetViewDays,
  onSetRoomTypeId,
  onSetRoomStatusFilter,
  canManageReservations,
  onNewReservation,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {availableProperties.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Property:</span>
            <span className="font-medium">{currentProperty.name}</span>
            <Button variant="ghost" href="/select-property">
              Switch
            </Button>
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-muted-foreground">Property:</span>{" "}
            <span className="font-medium">{currentProperty.name}</span>
          </div>
        )}

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={onPrev}>
            ←
          </Button>
          <Button variant="ghost" onClick={onToday}>
            Today
          </Button>
          <Button variant="ghost" onClick={onNext}>
            →
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {from} → {to}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button variant={viewBtnVariant(viewDays === 7)} onClick={() => onSetViewDays(7)}>
            7d
          </Button>
          <Button variant={viewBtnVariant(viewDays === 14)} onClick={() => onSetViewDays(14)}>
            14d
          </Button>
          <Button variant={viewBtnVariant(viewDays === 30)} onClick={() => onSetViewDays(30)}>
            30d
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted-foreground">Room type</label>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={roomTypeId ?? ""}
            onChange={(e) => onSetRoomTypeId(e.target.value ? e.target.value : null)}
          >
            <option value="">All</option>
            {roomTypeOptions.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>

          <label className="text-sm text-muted-foreground">Status</label>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={roomStatusFilter}
            onChange={(e) => onSetRoomStatusFilter(e.target.value as RoomStatusFilter)}
          >
            <option value="ALL">All</option>
            <option value="CLEAN">Clean</option>
            <option value="DIRTY">Dirty</option>
            <option value="OUT_OF_ORDER">Out of order</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={onNewReservation}
          disabled={!canManageReservations}
          title={canManageReservations ? "" : "Only OWNER/MANAGER can create"}
        >
          New reservation
        </Button>
      </div>
    </div>
  );
}
