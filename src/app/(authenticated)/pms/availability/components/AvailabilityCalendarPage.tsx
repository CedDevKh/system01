"use client";

import * as React from "react";

import { AvailabilityToolbar } from "./AvailabilityToolbar";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { ReservationDrawer, type DrawerMode } from "./ReservationDrawer";
import { useAvailabilityData } from "./useAvailabilityData";
import type { AvailabilityResponse, ViewDays } from "./types";
import type { DateFormat } from "@/lib/dateFormat";

type PropertyOption = { id: string; name: string };

type Props = {
  initial: AvailabilityResponse;
  initialFrom: string;
  initialViewDays: ViewDays;
  initialScrollIndex: number;
  dateFormat: DateFormat;

  currentProperty: PropertyOption;
  availableProperties: PropertyOption[];

  canManageReservations: boolean;
};

export function AvailabilityCalendarPage({
  initial,
  initialFrom,
  initialViewDays,
  initialScrollIndex,
  dateFormat,
  currentProperty,
  availableProperties,
  canManageReservations,
}: Props) {
  const {
    data,
    filteredRooms,
    roomTypes,
    summary,
    ui,
    setUi,
    to,
    loading,
    error,
    goPrev,
    goNext,
    goToday,
    setViewDays,
    refresh,
    extendRight,
    extending,
    getOccupancy,
  } = useAvailabilityData(initial, initialFrom, initialViewDays);

  const [drawer, setDrawer] = React.useState<DrawerMode>({ kind: "closed" });

  return (
    <div className="space-y-4 min-w-0">
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <AvailabilityToolbar
        currentProperty={currentProperty}
        availableProperties={availableProperties}
        from={ui.from}
        to={to}
        viewDays={ui.viewDays}
        roomTypeId={ui.roomTypeId}
        roomTypeOptions={roomTypes.map((rt) => ({ id: rt.id, name: rt.name }))}
        roomStatusFilter={ui.roomStatusFilter}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onSetViewDays={setViewDays}
        onSetRoomTypeId={(roomTypeId) => setUi((prev) => ({ ...prev, roomTypeId }))}
        onSetRoomStatusFilter={(roomStatusFilter) => setUi((prev) => ({ ...prev, roomStatusFilter }))}
        canManageReservations={canManageReservations}
        onNewReservation={() =>
          setDrawer({ kind: "new", roomId: filteredRooms[0]?.id ?? "", startDate: ui.from, endDate: to })}
      />

      {loading ? <div className="text-sm text-black/60">Loading…</div> : null}
      {extending ? <div className="text-sm text-black/60">Loading more dates…</div> : null}

      <AvailabilityGrid
        key={`${ui.from}:${ui.viewDays}`}
        dates={data.dates}
        rooms={filteredRooms}
        dailySummary={summary}
        dateFormat={dateFormat}
        roomStatusFilter={ui.roomStatusFilter}
        canManageReservations={canManageReservations}
        initialScrollIndex={initialScrollIndex}
        getOccupancy={getOccupancy}
        onExtendRight={() => void extendRight()}
        onOpenReservation={(reservationId: string) => setDrawer({ kind: "stay", reservationId })}
        onNewReservation={(roomId: string, startDate: string, endDate: string) =>
          setDrawer({ kind: "new", roomId, startDate, endDate })}
        onAfterMutation={refresh}
      />

      <ReservationDrawer
        mode={drawer}
        onClose={() => setDrawer({ kind: "closed" })}
        canManageReservations={canManageReservations}
        rooms={filteredRooms}
        onCreated={(reservationId) => {
          setDrawer({ kind: "stay", reservationId });
          void refresh();
        }}
      />
    </div>
  );
}
