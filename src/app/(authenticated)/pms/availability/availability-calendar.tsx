"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { formatDateOnly, type DateFormat } from "@/lib/dateFormat";

type Room = {
  id: string;
  name: string;
};

type Stay = {
  reservationId: string;
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD exclusive
  guestName?: string | null;
};

type Block = {
  id: string;
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD exclusive
  reason?: string | null;
};

type Props = {
  rooms: Room[];
  dates: string[]; // YYYY-MM-DD, each column is a date (inclusive)
  toExclusive: string; // YYYY-MM-DD (exclusive)
  stays: Stay[];
  blocks: Block[];
  canEditStays: boolean;
  dateFormat: DateFormat;
  renderWindow?: { startIndex: number; endIndex: number }; // virtualized window in `dates`
};

type DragState = {
  reservationId: string;
  roomId: string;
  startIndex: number;
  endIndex: number;
  pointerId: number;
} | null;

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHeaderDate(dateOnly: string, format: DateFormat) {
  // Keep headers compact, but respect ordering/separators.
  // ISO: MM-DD; DMY: DD/MM; MDY: MM/DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  const yyyy = dateOnly.slice(0, 4);
  const mm = dateOnly.slice(5, 7);
  const dd = dateOnly.slice(8, 10);
  if (format === "DMY") return `${dd}/${mm}`;
  if (format === "MDY") return `${mm}/${dd}`;
  // ISO
  return `${mm}-${dd}`;
}

function endDateFromIndex(dates: string[], toExclusive: string, endIndex: number) {
  if (endIndex >= dates.length) return toExclusive;
  return dates[endIndex];
}

export function AvailabilityCalendar({
  rooms,
  dates,
  toExclusive,
  stays,
  blocks,
  canEditStays,
  dateFormat,
  renderWindow,
}: Props) {
  const cellWidth = 56;

  const windowStartIndex = clampInt(renderWindow?.startIndex ?? 0, 0, dates.length);
  const windowEndIndex = clampInt(renderWindow?.endIndex ?? dates.length, 0, dates.length);

  const dateToIndex = React.useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  const staysByRoom = React.useMemo(() => {
    const m = new Map<string, Stay[]>();
    for (const s of stays) {
      const list = m.get(s.roomId) ?? [];
      list.push(s);
      m.set(s.roomId, list);
    }
    return m;
  }, [stays]);

  const blocksByRoom = React.useMemo(() => {
    const m = new Map<string, Block[]>();
    for (const b of blocks) {
      const list = m.get(b.roomId) ?? [];
      list.push(b);
      m.set(b.roomId, list);
    }
    return m;
  }, [blocks]);

  const [drag, setDrag] = React.useState<DragState>(null);
  const [pendingEndIndex, setPendingEndIndex] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState<string | null>(null);

  const gridStyle = React.useMemo(
    () => ({
      gridTemplateColumns: `repeat(${dates.length}, ${cellWidth}px)`,
      gridAutoRows: "40px",
    }),
    [dates.length],
  );

  function getSpanIndices(startDate: string, endDate: string) {
    const rawStartIndex = dateToIndex.get(startDate);
    const rawEndIndex = dateToIndex.get(endDate);

    const startIndex = rawStartIndex ?? 0;
    const endIndex =
      rawEndIndex ?? (endDate === toExclusive ? dates.length : dates.length);

    return {
      startIndex: clampInt(startIndex, 0, dates.length),
      endIndex: clampInt(endIndex, 0, dates.length),
    };
  }

  function startResize(e: React.PointerEvent, stay: Stay, startIndex: number, endIndex: number) {
    e.preventDefault();
    e.stopPropagation();

    if (!canEditStays) return;

    // If the stay already ends beyond (or at) the end of the visible window, don't allow resizing
    // because we can't represent dates beyond the current range.
    if (endIndex >= dates.length) return;

    setError(null);
    setDrag({
      reservationId: stay.reservationId,
      roomId: stay.roomId,
      startIndex,
      endIndex,
      pointerId: e.pointerId,
    });

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  async function commitResize(reservationId: string, startDate: string, endIndex: number) {
    const endDate = endDateFromIndex(dates, toExclusive, endIndex);

    const res = await fetch(`/api/pms/stays/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_DATES", startDate, endDate }),
    });

    if (!res.ok) {
      let message = "Unable to extend stay.";
      try {
        const j = (await res.json()) as any;
        message = j?.error ?? message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    const grid = (e.currentTarget as HTMLElement).querySelector(
      `[data-room-grid="${drag.roomId}"]`,
    ) as HTMLElement | null;

    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const col = Math.floor(x / cellWidth);

    // endIndex is exclusive, so hovering col N means endIndex = N+1
    const proposedEndIndex = col + 1;

    // Virtualized rendering: only allow resizing within the currently rendered window.
    // The user can scroll further right to extend beyond.
    const clamped = clampInt(proposedEndIndex, drag.startIndex + 1, windowEndIndex);
    setPendingEndIndex((prev) => ({ ...prev, [drag.reservationId]: clamped }));
  }

  async function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    const reservationId = drag.reservationId;

    const stay = stays.find((s) => s.reservationId === reservationId);
    if (!stay) {
      setDrag(null);
      return;
    }

    const newEndIndex = pendingEndIndex[reservationId] ?? drag.endIndex;

    setDrag(null);

    // No change
    if (newEndIndex === drag.endIndex) return;

    try {
      await commitResize(reservationId, stay.startDate, newEndIndex);
    } catch (err) {
      setPendingEndIndex((prev) => {
        const next = { ...prev };
        delete next[reservationId];
        return next;
      });
      setError(err instanceof Error ? err.message : "Unable to extend stay.");
    }
  }

  return (
    <div className="relative space-y-2" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="flex border-b">
        <div className="w-48 shrink-0 py-2 pr-4 text-sm font-medium sticky left-0 z-20 bg-white">Room</div>
        <div className="grid" style={gridStyle}>
          {dates.slice(windowStartIndex, windowEndIndex).map((d, offset) => {
            const i = windowStartIndex + offset;
            return (
              <div
                key={d}
                className="py-2 px-2 text-sm font-medium whitespace-nowrap"
                style={{ gridColumn: i + 1 }}
              >
                {formatHeaderDate(d, dateFormat)}
              </div>
            );
          })}
        </div>
      </div>

      {rooms.map((room) => {
        const roomStays = staysByRoom.get(room.id) ?? [];
        const roomBlocks = blocksByRoom.get(room.id) ?? [];

        // Invariant: these should not overlap; if they do, they will visually overlap.
        const bars: Array<
          | {
              kind: "stay";
              key: string;
              fullStartIndex: number;
              fullEndIndex: number;
              renderStartIndex: number;
              renderEndIndex: number;
              stay: Stay;
            }
          | {
              kind: "block";
              key: string;
              fullStartIndex: number;
              fullEndIndex: number;
              renderStartIndex: number;
              renderEndIndex: number;
              block: Block;
            }
        > = [];

        for (const s of roomStays) {
          const { startIndex, endIndex } = getSpanIndices(s.startDate, s.endDate);
          if (endIndex <= 0 || startIndex >= dates.length) continue;

          const effectiveEndIndex = pendingEndIndex[s.reservationId] ?? endIndex;

          const renderStartIndex = Math.max(startIndex, windowStartIndex);
          const renderEndIndex = Math.min(effectiveEndIndex, windowEndIndex);
          if (renderEndIndex <= renderStartIndex) continue;

          bars.push({
            kind: "stay",
            key: `stay:${s.reservationId}`,
            fullStartIndex: startIndex,
            fullEndIndex: effectiveEndIndex,
            renderStartIndex,
            renderEndIndex,
            stay: s,
          });
        }

        for (const b of roomBlocks) {
          const { startIndex, endIndex } = getSpanIndices(b.startDate, b.endDate);
          if (endIndex <= 0 || startIndex >= dates.length) continue;

          const renderStartIndex = Math.max(startIndex, windowStartIndex);
          const renderEndIndex = Math.min(endIndex, windowEndIndex);
          if (renderEndIndex <= renderStartIndex) continue;

          bars.push({
            kind: "block",
            key: `block:${b.id}`,
            fullStartIndex: startIndex,
            fullEndIndex: endIndex,
            renderStartIndex,
            renderEndIndex,
            block: b,
          });
        }

        return (
          <div key={room.id} className="flex border-b">
            <div className="w-48 shrink-0 py-2 pr-4 whitespace-nowrap sticky left-0 z-10 bg-white">{room.name}</div>

            <div
              className="relative grid"
              style={gridStyle}
              data-room-grid={room.id}
              aria-label={`Availability for ${room.name}`}
            >
              {dates.slice(windowStartIndex, windowEndIndex).map((d, offset) => {
                const i = windowStartIndex + offset;
                return (
                  <div
                    key={d}
                    className="border-r border-black/10"
                    style={{ gridColumn: i + 1, gridRow: 1 }}
                  />
                );
              })}

              {bars.map((bar) => {
                const span = Math.max(1, bar.renderEndIndex - bar.renderStartIndex);

                if (bar.kind === "block") {
                  const label = bar.block.reason ? `BLK: ${bar.block.reason}` : "BLK";
                  return (
                    <div
                      key={bar.key}
                      className="z-10 self-center -mr-1 h-8 overflow-hidden whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2 text-xs text-amber-900 flex items-center"
                      style={{
                        gridRow: 1,
                        gridColumn: `${bar.renderStartIndex + 1} / span ${span}`,
                      }}
                      title={label}
                    >
                      {label}
                    </div>
                  );
                }

                const title = bar.stay.guestName
                  ? bar.stay.guestName
                  : `Stay ${bar.stay.reservationId.slice(0, 6)}`;

                return (
                  <div
                    key={bar.key}
                    className="relative z-10 self-center -mr-1"
                    style={{
                      gridRow: 1,
                      gridColumn: `${bar.renderStartIndex + 1} / span ${span}`,
                    }}
                  >
                    <Button
                      href={`/pms/stays/${bar.stay.reservationId}`}
                      variant="ghost"
                      className="w-full h-8 justify-start overflow-hidden whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900 hover:bg-blue-50"
                      title={title}
                    >
                      {title}
                    </Button>

                    {canEditStays ? (
                      <div
                        role="slider"
                        aria-label="Extend stay"
                        tabIndex={0}
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                        onPointerDown={(e) =>
                          startResize(e, bar.stay, bar.fullStartIndex, bar.fullEndIndex)
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
