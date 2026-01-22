"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  createReservationFromSearch,
  searchAvailability,
  type AvailabilityState,
  type CreateReservationState,
} from "./actions";

type RoomTypeRow = {
  id: string;
  code: string;
  name: string;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roomLabel(room: { name: string; roomType: { code: string; name: string } }) {
  return `${room.name} (${room.roomType.code})`;
}

export default function NewReservationClient({
  roomTypes,
}: {
  roomTypes: RoomTypeRow[];
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }, [today]);

  const initialRoomTypeId = roomTypes[0]?.id ?? "";

  const initialSearch: AvailabilityState = {
    ok: false,
    error: null,
    checkInDate: toDateInputValue(today),
    checkOutDate: toDateInputValue(tomorrow),
    roomTypeId: initialRoomTypeId,
    adults: "2",
    children: "0",
    availableRooms: [],
  };

  const [searchState, searchAction] = useActionState(searchAvailability, initialSearch);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  useEffect(() => {
    if (!searchState.ok) {
      setSelectedRoomId("");
      return;
    }

    if (selectedRoomId && !searchState.availableRooms.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId("");
    }
  }, [searchState.ok, searchState.availableRooms, selectedRoomId]);

  const selectedRoom =
    searchState.ok && selectedRoomId
      ? searchState.availableRooms.find((r) => r.id === selectedRoomId) ?? null
      : null;

  const initialCreate: CreateReservationState = { ok: false, error: null };
  const [createState, createAction] = useActionState(
    createReservationFromSearch,
    initialCreate,
  );

  if (roomTypes.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-4">
        <div className="text-sm font-semibold">New reservation</div>
        <div className="mt-2 text-sm text-black/70">
          No room types found. Create a room type first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="text-sm font-semibold">Search availability</div>

        <form action={searchAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-sm">Check-in</label>
            <input
              name="checkInDate"
              type="date"
              className="border px-2 py-1"
              defaultValue={searchState.checkInDate}
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm">Check-out</label>
            <input
              name="checkOutDate"
              type="date"
              className="border px-2 py-1"
              defaultValue={searchState.checkOutDate}
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm">Room type</label>
            <select
              name="roomTypeId"
              className="border px-2 py-1"
              defaultValue={searchState.roomTypeId}
              required
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.code} — {rt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm">Adults</label>
            <input
              name="adults"
              type="number"
              min={1}
              max={20}
              className="border px-2 py-1 w-24"
              defaultValue={searchState.adults || "2"}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm">Children</label>
            <input
              name="children"
              type="number"
              min={0}
              max={20}
              className="border px-2 py-1 w-24"
              defaultValue={searchState.children || "0"}
            />
          </div>

          <button type="submit" className="border px-3 py-1">
            Search
          </button>
        </form>

        {searchState.error ? (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
            {searchState.error}
          </div>
        ) : null}
      </section>

      {searchState.ok ? (
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <div className="text-sm font-semibold">Available rooms</div>
          {searchState.availableRooms.length === 0 ? (
            <div className="mt-2 text-sm text-black/70">
              No available rooms for the selected criteria.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {searchState.availableRooms.map((r) => {
                const selected = r.id === selectedRoomId;
                return (
                  <div
                    key={r.id}
                    className={
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2 " +
                      (selected ? "border-black/30 bg-black/[0.02]" : "border-black/10")
                    }
                  >
                    <div>
                      <div className="text-sm font-medium">{roomLabel(r)}</div>
                      <div className="text-xs text-black/60">{r.roomType.name}</div>
                    </div>
                    <button
                      type="button"
                      className="border px-3 py-1 text-sm"
                      onClick={() => setSelectedRoomId(r.id)}
                    >
                      Select
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {searchState.ok && selectedRoom ? (
        <section className="rounded-lg border border-black/10 bg-white p-4">
          <div className="text-sm font-semibold">Guest details &amp; confirm</div>
          <div className="mt-1 text-sm text-black/70">
            Selected room: <span className="font-medium">{roomLabel(selectedRoom)}</span>
          </div>

          {createState.error ? (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
              {createState.error}
            </div>
          ) : null}

          <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="checkInDate" value={searchState.checkInDate} />
            <input type="hidden" name="checkOutDate" value={searchState.checkOutDate} />
            <input type="hidden" name="roomTypeId" value={searchState.roomTypeId} />
            <input type="hidden" name="roomId" value={selectedRoomId} />
            <input type="hidden" name="adults" value={searchState.adults || "2"} />
            <input type="hidden" name="children" value={searchState.children || "0"} />

            <div className="flex flex-col">
              <label className="text-sm">First name</label>
              <input name="firstName" className="border px-2 py-1" required />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Last name</label>
              <input name="lastName" className="border px-2 py-1" required />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Email</label>
              <input name="email" type="email" className="border px-2 py-1" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Phone</label>
              <input name="phone" className="border px-2 py-1" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Channel</label>
              <input
                name="channel"
                className="border px-2 py-1"
                defaultValue="DIRECT"
              />
            </div>
            <div className="flex flex-col grow min-w-[240px]">
              <label className="text-sm">Notes</label>
              <textarea
                name="notes"
                className="border px-2 py-1"
                rows={1}
                placeholder="Optional"
              />
            </div>

            <button type="submit" className="border px-3 py-1">
              Create reservation
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
