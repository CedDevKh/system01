"use client";

/**
 * AvailabilityGrid scrolling model:
 * - Scroll container: the div with ref `scrollRef` (it is the ONLY horizontal scroller).
 *   It uses `overflow-x-auto` + `max-w-full` and also owns vertical scrolling.
 * - Full timeline width: the inner spacer div width = LEFT_COL_WIDTH + dates.length * DAY_WIDTH.
 *   This guarantees `scrollWidth > clientWidth` when there are enough days.
 * - Virtualization: only the visible date slice is rendered. The slice is aligned by rendering it
 *   inside a translated wrapper: `translateX(startIndex * DAY_WIDTH)` while keeping the full-width
 *   spacer to preserve scrollWidth.
 */

import * as React from "react";

import type {
  AvailabilityRoom,
  AvailabilityStay,
  AvailabilityBlock,
  AvailabilityOccupancy,
  DailySummary,
  RoomStatusFilter,
} from "./types";
import type { DateFormat } from "@/lib/dateFormat";
import { formatDateOnly } from "@/lib/dateFormat";
import { parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

const LEFT_COL_WIDTH = 200;
const DAY_WIDTH = 120;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;
const SUMMARY_HEIGHT = 40;
const OVERSCAN_DAYS = 6;

function toDateKey(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(String(value ?? ""));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Props = {
  dates: string[];
  rooms: AvailabilityRoom[];
  dailySummary: DailySummary[];
  dateFormat: DateFormat;
  roomStatusFilter: RoomStatusFilter;
  canManageReservations: boolean;
  initialScrollIndex: number;
  getOccupancy: (roomId: string, dateOnly: string) => AvailabilityOccupancy;
  onExtendRight: () => void;
  onOpenReservation: (reservationId: string) => void;
  onNewReservation: (roomId: string, startDate: string, endDate: string) => void;
  onAfterMutation: () => Promise<void>;
};

type RowData =
  | { kind: "roomType"; roomTypeId: string; name: string; count: number }
  | { kind: "room"; room: AvailabilityRoom };

function isWeekend(dateOnly: string): boolean {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(dateOnly: string, days: number): string {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function stayColor(status: AvailabilityStay["status"]): string {
  // Solid, clearly visible colors matching the reference design
  if (status === "CHECKED_IN") return "bg-emerald-500 text-white";
  if (status === "CONFIRMED") return "bg-sky-500 text-white";
  if (status === "CHECKED_OUT") return "bg-slate-400 text-white";
  return "bg-amber-400 text-slate-900"; // DRAFT / HOLD
}

function blockColor(): string {
  return "bg-rose-400 text-white";
}

function LegendItem({ label, className }: { label: string; className: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-sm ${className}`} aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function statusBadge(room: AvailabilityRoom): { label: string; className: string } | null {
  if (room.status === "OUT_OF_ORDER") return { label: "OOO", className: "bg-rose-100 text-rose-700" };
  if (room.housekeepingStatus === "DIRTY") return { label: "Dirty", className: "bg-amber-100 text-amber-700" };
  if (room.housekeepingStatus === "CLEAN") return { label: "Clean", className: "bg-emerald-100 text-emerald-700" };
  if (room.housekeepingStatus === "OUT_OF_SERVICE") return { label: "OOS", className: "bg-slate-100 text-slate-700" };
  return null;
}

function buildRows(rooms: AvailabilityRoom[], collapsed: Set<string>): RowData[] {
  const byType = new Map<string, { id: string; name: string; rooms: AvailabilityRoom[] }>();
  for (const r of rooms) {
    const existing = byType.get(r.roomType.id);
    if (existing) existing.rooms.push(r);
    else byType.set(r.roomType.id, { id: r.roomType.id, name: r.roomType.name, rooms: [r] });
  }

  const types = Array.from(byType.values()).sort((a, b) => a.name.localeCompare(b.name));
  const out: RowData[] = [];
  for (const t of types) {
    out.push({ kind: "roomType", roomTypeId: t.id, name: t.name, count: t.rooms.length });
    if (!collapsed.has(t.id)) {
      for (const r of t.rooms.sort((a, b) => a.name.localeCompare(b.name))) out.push({ kind: "room", room: r });
    }
  }
  return out;
}

function devLog(tag: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.log(`[AvailabilityGrid:${tag}]`, data);
}

export function AvailabilityGrid({
  dates,
  rooms,
  dailySummary,
  dateFormat,
  roomStatusFilter: _roomStatusFilter,
  canManageReservations,
  initialScrollIndex,
  getOccupancy,
  onExtendRight,
  onOpenReservation,
  onNewReservation,
  onAfterMutation,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const rows = React.useMemo(() => buildRows(rooms, collapsed), [rooms, collapsed]);

  const [interactionError, setInteractionError] = React.useState<string | null>(null);

  type DragKind = "stay" | "block";
  type DragEdge = "start" | "end";
  type DragState = {
    kind: DragKind;
    id: string;
    roomId: string;
    edge: DragEdge;
    pointerId: number;
  };

  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [stayOverrides, setStayOverrides] = React.useState<Record<string, { startDate: string; endDate: string }>>({});
  const [blockOverrides, setBlockOverrides] = React.useState<Record<string, { startDate: string; endDate: string }>>({});

  function dateAtIndex(index: number): string {
    const clamped = Math.max(0, Math.min(dates.length - 1, index));
    return toDateKey(dates[clamped] ?? "");
  }

  function endDateAtExclusiveIndex(endIndexExclusive: number): string {
    if (endIndexExclusive <= 0) return dateAtIndex(0);
    if (endIndexExclusive >= dates.length) {
      const last = toDateKey(dates[dates.length - 1] ?? "");
      return addDays(last, 1);
    }
    return toDateKey(dates[endIndexExclusive] ?? "");
  }

  function indexFromPointer(roomId: string, clientX: number): number | null {
    const el = scrollRef.current;
    if (!el) return null;
    const layer = el.querySelector(`[data-room-layer="${roomId}"]`) as HTMLElement | null;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    const x = clientX - rect.left;
    const localIndex = Math.floor(x / DAY_WIDTH);
    const idx = startIndex + localIndex;
    if (Number.isNaN(idx)) return null;
    return Math.max(0, Math.min(dates.length, idx));
  }

  async function commitStayDates(stayId: string, startDate: string, endDate: string) {
    const res = await fetch(`/api/pms/stays/${stayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_DATES", startDate, endDate }),
    });
    if (!res.ok) {
      let msg = "Unable to update reservation dates.";
      try {
        const j: unknown = await res.json();
        if (typeof j === "object" && j && "error" in j) {
          const v = (j as { error?: unknown }).error;
          if (typeof v === "string") msg = v;
        }
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
  }

  async function commitBlockDates(blockId: string, startDate: string, endDate: string) {
    const res = await fetch(`/api/pms/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
    });
    if (!res.ok) {
      let msg = "Unable to update block dates.";
      try {
        const j: unknown = await res.json();
        if (typeof j === "object" && j && "error" in j) {
          const v = (j as { error?: unknown }).error;
          if (typeof v === "string") msg = v;
        }
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
  }

  const todayKey = React.useMemo(() => toDateKey(new Date()), []);
  const totalDaysWidth = dates.length * DAY_WIDTH;
  const totalWidth = LEFT_COL_WIDTH + totalDaysWidth;

  const dateToIndex = React.useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(toDateKey(d), i));
    return m;
  }, [dates]);

  const firstDate = toDateKey(dates[0] ?? "");
  const lastDate = toDateKey(dates[dates.length - 1] ?? "");

  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [clientWidth, setClientWidth] = React.useState(0);

  function getDateIndex(dateOnly: string, fallbackBefore: number, fallbackAfter: number): number {
    const key = toDateKey(dateOnly);
    const idx = dateToIndex.get(key);
    if (idx != null) return idx;
    if (firstDate && key < firstDate) return fallbackBefore;
    if (lastDate && key > lastDate) return fallbackAfter;
    return fallbackAfter;
  }

  function toggleRoomType(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCellClick(roomId: string, dateIndex: number) {
    const startDate = dates[dateIndex];
    if (!startDate) return;

    // Only create from an empty cell.
    if (getOccupancy(roomId, startDate)) return;

    const endDate = addDays(startDate, 1);
    onNewReservation(roomId, startDate, endDate);
  }

  // Initial scroll position
  const didInitialScroll = React.useRef(false);
  React.useEffect(() => {
    if (didInitialScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;

    // Metrics on mount
    devLog("mount", { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft });

    if (initialScrollIndex >= 0 && initialScrollIndex < dates.length) {
      el.scrollLeft = Math.max(0, LEFT_COL_WIDTH + initialScrollIndex * DAY_WIDTH - 20);
      didInitialScroll.current = true;
      devLog("initialScroll", { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft });
    }
  }, [dates.length, initialScrollIndex]);

  // Scroll handler: track visible window + extend-right
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let raf: number | null = null;
    const onScroll = () => {
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollLeft(el.scrollLeft);
        setClientWidth(el.clientWidth);

        devLog("scroll", { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft });

        const distanceFromRight = el.scrollWidth - el.scrollLeft - el.clientWidth;
        if (distanceFromRight < DAY_WIDTH * 5) onExtendRight();
        raf = null;
      });
    };

    // Set initial width tracking
    setClientWidth(el.clientWidth);
    setScrollLeft(el.scrollLeft);

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [onExtendRight]);

  // Virtualized visible range (account for left column)
  const usableScrollLeft = Math.max(0, scrollLeft - LEFT_COL_WIDTH);
  const firstVisibleIndex = Math.max(0, Math.floor(usableScrollLeft / DAY_WIDTH));
  const usableClientWidth = Math.max(0, clientWidth - LEFT_COL_WIDTH);
  const visibleCount = Math.max(1, Math.ceil(usableClientWidth / DAY_WIDTH) + OVERSCAN_DAYS);
  const startIndex = Math.max(0, firstVisibleIndex - Math.floor(OVERSCAN_DAYS / 2));
  const endIndexExclusive = Math.min(dates.length, startIndex + visibleCount);
  const visibleDates = dates.slice(startIndex, endIndexExclusive);
  const visibleSummary = dailySummary.slice(startIndex, endIndexExclusive);

  function fmtHeader(dateOnly: string): string {
    return formatDateOnly(dateOnly, dateFormat);
  }

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
      {interactionError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
          {interactionError}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs">
        <span className="text-slate-500 font-medium">Legend:</span>
        <LegendItem label="Confirmed" className={stayColor("CONFIRMED")} />
        <LegendItem label="Checked-in" className={stayColor("CHECKED_IN")} />
        <LegendItem label="Checked-out" className={stayColor("CHECKED_OUT")} />
        <LegendItem label="Draft" className={stayColor("DRAFT")} />
        <LegendItem label="Block" className={blockColor()} />
      </div>

      {/* The ONLY horizontal scroll container */}
      <div
        ref={scrollRef}
        className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto"
        style={{ height: "70vh" }}
      >
        {/* Full-width spacer: creates scrollWidth */}
        <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
          {process.env.NODE_ENV !== "production" ? (
            <div
              className="absolute right-2 top-2 z-50 rounded bg-black/70 px-2 py-1 text-[11px] text-white"
              style={{ pointerEvents: "none" }}
            >
              clientWidth={Math.round(clientWidth)} scrollWidth={Math.round(totalWidth)} scrollLeft={Math.round(scrollLeft)}
            </div>
          ) : null}
          {/* Sticky header */}
          <div
            className="flex border-b border-slate-200 bg-slate-100"
            style={{ position: "sticky", top: 0, zIndex: 20, height: HEADER_HEIGHT }}
          >
            <div
              className="flex items-center px-4 border-r-2 border-slate-300 bg-white text-sm font-semibold text-slate-700 shrink-0"
              style={{ position: "sticky", left: 0, zIndex: 30, width: LEFT_COL_WIDTH }}
            >
              Room
            </div>
            <div className="relative" style={{ width: totalDaysWidth, height: HEADER_HEIGHT }}>
              <div style={{ transform: `translateX(${startIndex * DAY_WIDTH}px)` }}>
                <div className="flex">
                  {visibleDates.map((d) => {
                    const weekend = isWeekend(d);
                    const isToday = toDateKey(d) === todayKey;
                    return (
                      <div
                        key={d}
                        className={
                          "relative shrink-0 flex flex-col items-center justify-center border-r border-slate-200 px-2 py-1 text-xs " +
                          "font-medium text-slate-600 " +
                          (weekend ? "bg-slate-100 " : "bg-slate-50 ") +
                          (isToday ? "!bg-sky-100 !text-sky-700 " : "")
                        }
                        style={{ width: DAY_WIDTH }}
                        title={fmtHeader(d)}
                      >
                        <span>{fmtHeader(d)}</span>
                        {isToday ? (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                            Today
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Body rows */}
          {rows.map((row) => {
            if (row.kind === "roomType") {
              return (
                <div
                  key={`rt-${row.roomTypeId}`}
                  className="flex border-b border-slate-200 bg-slate-50"
                  style={{ height: ROW_HEIGHT }}
                >
                  <button
                    type="button"
                    onClick={() => toggleRoomType(row.roomTypeId)}
                    className="flex items-center gap-2 px-4 border-r-2 border-slate-300 bg-slate-100 text-sm font-semibold text-slate-800 shrink-0 hover:bg-slate-200 transition-colors"
                    style={{ position: "sticky", left: 0, zIndex: 10, width: LEFT_COL_WIDTH }}
                  >
                    <span className="text-slate-500">{collapsed.has(row.roomTypeId) ? "▶" : "▼"}</span>
                    <span className="truncate">{row.name}</span>
                    <span className="text-slate-500 font-normal">({row.count})</span>
                  </button>

                  <div className="relative" style={{ width: totalDaysWidth, height: ROW_HEIGHT }}>
                    <div style={{ transform: `translateX(${startIndex * DAY_WIDTH}px)` }}>
                      <div className="flex">
                        {visibleDates.map((d) => {
                          const weekend = isWeekend(d);
                          const isToday = toDateKey(d) === todayKey;
                          return (
                            <div
                              key={`${row.roomTypeId}:${d}`}
                              className={
                                "shrink-0 border-r border-slate-200 " +
                                (weekend ? "bg-slate-100 " : "bg-slate-50 ") +
                                (isToday ? "!bg-sky-50 " : "")
                              }
                              style={{ width: DAY_WIDTH, height: ROW_HEIGHT }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const room = row.room;
            const badge = statusBadge(room);

            return (
              <div
                key={`room-${room.id}`}
                className="flex border-b border-slate-200 bg-white relative"
                style={{ height: ROW_HEIGHT }}
              >
                <div
                  className="flex items-center justify-between px-4 border-r-2 border-slate-300 bg-white shrink-0"
                  style={{ position: "sticky", left: 0, zIndex: 10, width: LEFT_COL_WIDTH }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{room.name}</div>
                    <div className="text-xs text-slate-500 truncate">{room.roomType.code}</div>
                  </div>
                  {badge ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                  ) : null}
                </div>

                <div className="relative" style={{ width: totalDaysWidth, height: ROW_HEIGHT }}>
                  {/* Virtualized background cells */}
                  <div style={{ transform: `translateX(${startIndex * DAY_WIDTH}px)` }}>
                    <div className="flex relative" style={{ height: ROW_HEIGHT }} data-room-layer={room.id}>
                      {visibleDates.map((d, localIndex) => {
                        const dateIndex = startIndex + localIndex;
                        const weekend = isWeekend(d);
                        const isToday = toDateKey(d) === todayKey;
                        const occ = getOccupancy(room.id, d);
                        return (
                          <button
                            key={`${room.id}:${d}`}
                            type="button"
                            onClick={() => handleCellClick(room.id, dateIndex)}
                            className={
                              "shrink-0 border-r border-slate-200 hover:bg-slate-100 transition-colors " +
                              (weekend ? "bg-slate-50 " : "bg-white ") +
                              (isToday ? "!bg-sky-50 " : "")
                            }
                            style={{ width: DAY_WIDTH, height: ROW_HEIGHT }}
                            title={`Click to create reservation on ${d}`}
                          />
                        );
                      })}

                      {/* Blocks overlay (only those intersecting visible range) */}
                      {room.blocks.map((b) => {
                        const override = blockOverrides[b.id];
                        const startIdx = getDateIndex(override?.startDate ?? b.startDate, 0, dates.length);
                        const endIdx = getDateIndex(override?.endDate ?? b.endDate, 0, dates.length);
                        const clampedStart = Math.max(startIndex, Math.min(endIndexExclusive, startIdx));
                        const clampedEnd = Math.max(startIndex, Math.min(endIndexExclusive, endIdx));
                        if (clampedEnd <= clampedStart) return null;

                        const left = (clampedStart - startIndex) * DAY_WIDTH + 2;
                        const width = (clampedEnd - clampedStart) * DAY_WIDTH - 4;

                        const canResize = canManageReservations;

                        function startDrag(edge: DragEdge, e: React.PointerEvent) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!canResize) return;
                          setInteractionError(null);
                          setDrag({ kind: "block", id: b.id, roomId: room.id, edge, pointerId: e.pointerId });
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }

                        async function onPointerMove(e: React.PointerEvent) {
                          if (!drag) return;
                          if (drag.kind !== "block" || drag.id !== b.id) return;
                          if (e.pointerId !== drag.pointerId) return;

                          const idx = indexFromPointer(room.id, e.clientX);
                          if (idx == null) return;

                          const current = blockOverrides[b.id] ?? {
                            startDate: toDateKey(b.startDate),
                            endDate: toDateKey(b.endDate),
                          };
                          const startIndex = getDateIndex(current.startDate, 0, dates.length);
                          const endIndex = getDateIndex(current.endDate, 0, dates.length);

                          if (drag.edge === "start") {
                            const nextStart = Math.min(Math.max(0, idx), endIndex - 1);
                            setBlockOverrides((prev) => ({
                              ...prev,
                              [b.id]: { startDate: dateAtIndex(nextStart), endDate: current.endDate },
                            }));
                          } else {
                            const nextEnd = Math.max(startIndex + 1, Math.min(dates.length, idx + 1));
                            const nextEndDate = endDateAtExclusiveIndex(nextEnd);
                            setBlockOverrides((prev) => ({
                              ...prev,
                              [b.id]: { startDate: current.startDate, endDate: nextEndDate },
                            }));
                          }
                        }

                        async function onPointerUp(e: React.PointerEvent) {
                          if (!drag) return;
                          if (drag.kind !== "block" || drag.id !== b.id) return;
                          if (e.pointerId !== drag.pointerId) return;
                          setDrag(null);

                          const next = blockOverrides[b.id];
                          if (!next) return;
                          const same = next.startDate === toDateKey(b.startDate) && next.endDate === toDateKey(b.endDate);
                          if (same) {
                            setBlockOverrides((prev) => {
                              const n = { ...prev };
                              delete n[b.id];
                              return n;
                            });
                            return;
                          }

                          let committed = false;
                          try {
                            await commitBlockDates(b.id, next.startDate, next.endDate);
                            committed = true;
                            await onAfterMutation();
                            setBlockOverrides((prev) => {
                              const n = { ...prev };
                              delete n[b.id];
                              return n;
                            });
                          } catch (err) {
                            setInteractionError(err instanceof Error ? err.message : "Unable to update block dates.");
                            if (!committed) {
                              setBlockOverrides((prev) => {
                                const n = { ...prev };
                                delete n[b.id];
                                return n;
                              });
                            }
                          }
                        }

                        return (
                          <div
                            key={b.id}
                            className={`group absolute top-1 rounded-md text-xs font-medium px-3 flex items-center overflow-hidden shadow-sm ${blockColor()}`}
                            style={{ left, width, height: ROW_HEIGHT - 8 }}
                            title={b.reason || "Block"}
                          >
                            {canResize ? (
                              <>
                                <div
                                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
                                  role="presentation"
                                  onPointerDown={(e) => startDrag("start", e)}
                                  onPointerMove={onPointerMove}
                                  onPointerUp={onPointerUp}
                                  title="Drag to change start"
                                />
                                <div
                                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
                                  role="presentation"
                                  onPointerDown={(e) => startDrag("end", e)}
                                  onPointerMove={onPointerMove}
                                  onPointerUp={onPointerUp}
                                  title="Drag to change end"
                                />
                              </>
                            ) : null}
                            <span className="truncate">{b.reason || "Block"}</span>
                          </div>
                        );
                      })}

                      {/* Stays overlay */}
                      {room.stays.map((s) => {
                        const override = stayOverrides[s.id];
                        // Stays are night-based: checkout date is exclusive.
                        // A date D is occupied by a stay iff: D >= checkInDate AND D < checkOutDate.
                        // Comparisons are key-based (YYYY-MM-DD) to avoid timezone shifts.
                        const checkInKey = override?.startDate ?? (s.startDateKey ?? toDateKey(s.startDate));
                        const checkOutKey = override?.endDate ?? (s.endDateKey ?? toDateKey(s.endDate));
                        const stayStartIndex = getDateIndex(checkInKey, 0, dates.length);
                        const stayEndIndexExclusive = getDateIndex(checkOutKey, 0, dates.length);

                        let nights = stayEndIndexExclusive - stayStartIndex;
                        if (nights <= 0) nights = 1;

                        const stayDisplayEndExclusive = stayStartIndex + nights;
                        const visibleStart = Math.max(startIndex, Math.min(endIndexExclusive, stayStartIndex));
                        const visibleEndExclusive = Math.max(startIndex, Math.min(endIndexExclusive, stayDisplayEndExclusive));
                        if (visibleEndExclusive <= visibleStart) return null;

                        const left = (visibleStart - startIndex) * DAY_WIDTH + 2;
                        const width = (visibleEndExclusive - visibleStart) * DAY_WIDTH - 4;
                        const barHeight = ROW_HEIGHT - 8;
                        const canShowEdgeLabels = width >= 140;

                        const canResize = canManageReservations;

                        function startDrag(edge: DragEdge, e: React.PointerEvent) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!canResize) return;
                          setInteractionError(null);
                          setDrag({ kind: "stay", id: s.id, roomId: room.id, edge, pointerId: e.pointerId });
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }

                        async function onPointerMove(e: React.PointerEvent) {
                          if (!drag) return;
                          if (drag.kind !== "stay" || drag.id !== s.id) return;
                          if (e.pointerId !== drag.pointerId) return;

                          const idx = indexFromPointer(room.id, e.clientX);
                          if (idx == null) return;

                          const current = stayOverrides[s.id] ?? { startDate: checkInKey, endDate: checkOutKey };
                          const startIndex = getDateIndex(current.startDate, 0, dates.length);
                          const endIndex = getDateIndex(current.endDate, 0, dates.length);

                          if (drag.edge === "start") {
                            const nextStart = Math.min(Math.max(0, idx), endIndex - 1);
                            setStayOverrides((prev) => ({
                              ...prev,
                              [s.id]: { startDate: dateAtIndex(nextStart), endDate: current.endDate },
                            }));
                          } else {
                            const nextEndIdx = Math.max(startIndex + 1, Math.min(dates.length, idx + 1));
                            const nextEndDate = endDateAtExclusiveIndex(nextEndIdx);
                            setStayOverrides((prev) => ({
                              ...prev,
                              [s.id]: { startDate: current.startDate, endDate: nextEndDate },
                            }));
                          }
                        }

                        async function onPointerUp(e: React.PointerEvent) {
                          if (!drag) return;
                          if (drag.kind !== "stay" || drag.id !== s.id) return;
                          if (e.pointerId !== drag.pointerId) return;
                          setDrag(null);

                          const next = stayOverrides[s.id];
                          if (!next) return;

                          const origStart = s.startDateKey ?? toDateKey(s.startDate);
                          const origEnd = s.endDateKey ?? toDateKey(s.endDate);
                          const same = next.startDate === origStart && next.endDate === origEnd;
                          if (same) {
                            setStayOverrides((prev) => {
                              const n = { ...prev };
                              delete n[s.id];
                              return n;
                            });
                            return;
                          }

                          let committed = false;
                          try {
                            await commitStayDates(s.id, next.startDate, next.endDate);
                            committed = true;
                            await onAfterMutation();
                            setStayOverrides((prev) => {
                              const n = { ...prev };
                              delete n[s.id];
                              return n;
                            });
                          } catch (err) {
                            setInteractionError(err instanceof Error ? err.message : "Unable to update reservation dates.");
                            if (!committed) {
                              setStayOverrides((prev) => {
                                const n = { ...prev };
                                delete n[s.id];
                                return n;
                              });
                            }
                          }
                        }

                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onOpenReservation(s.id)}
                            className={`group absolute top-1 rounded-md text-xs font-medium overflow-hidden cursor-pointer shadow-sm hover:opacity-90 transition-opacity ${stayColor(s.status)}`}
                            style={{ left, width, height: barHeight }}
                            title={`${s.guestName}\n${s.startDate} → ${s.endDate}\n${s.status}`}
                          >
                            {canResize ? (
                              <>
                                <div
                                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
                                  role="presentation"
                                  onPointerDown={(e) => startDrag("start", e)}
                                  onPointerMove={onPointerMove}
                                  onPointerUp={onPointerUp}
                                  title="Drag to change check-in"
                                />
                                <div
                                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
                                  role="presentation"
                                  onPointerDown={(e) => startDrag("end", e)}
                                  onPointerMove={onPointerMove}
                                  onPointerUp={onPointerUp}
                                  title="Drag to change checkout"
                                />
                              </>
                            ) : null}
                            {/* Edge cues (do not affect width): check-in PM (left) and checkout AM (right) */}
                            <div
                              className="pointer-events-none absolute left-0 top-0 h-full w-3 bg-white/20"
                              style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                              aria-hidden="true"
                            />
                            <div
                              className="pointer-events-none absolute right-0 top-0 h-full w-3 bg-white/20"
                              style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
                              aria-hidden="true"
                            />

                            {/* Hover-only edge labels */}
                            {canShowEdgeLabels ? (
                              <>
                                <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 rounded bg-black/30 px-1 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  Check-in PM
                                </span>
                                <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded bg-black/30 px-1 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  Checkout AM
                                </span>
                              </>
                            ) : null}

                            {/* Content padding accounts for edge cues */}
                            <div className="flex w-full items-center gap-1 px-3">
                              <span className="truncate font-medium">{s.guestName}</span>
                              {width > 120 ? (
                                <span className="text-white/80 text-[10px] truncate ml-auto">
                                  {s.channel || s.source}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sticky summary row */}
          <div
            className="flex border-t-2 border-slate-300 bg-slate-100"
            style={{ position: "sticky", bottom: 0, zIndex: 20, height: SUMMARY_HEIGHT }}
          >
            <div
              className="flex items-center px-4 border-r-2 border-slate-300 bg-white text-sm font-semibold text-slate-700 shrink-0"
              style={{ position: "sticky", left: 0, zIndex: 30, width: LEFT_COL_WIDTH }}
            >
              Occupancy
            </div>

            <div className="relative" style={{ width: totalDaysWidth, height: SUMMARY_HEIGHT }}>
              <div style={{ transform: `translateX(${startIndex * DAY_WIDTH}px)` }}>
                <div className="flex">
                  {visibleSummary.map((s) => {
                    const weekend = isWeekend(s.date);
                    const isToday = toDateKey(s.date) === todayKey;
                    return (
                      <div
                        key={s.date}
                        className={
                          "shrink-0 flex flex-col items-center justify-center border-r border-slate-200 text-xs " +
                          (weekend ? "bg-slate-100 " : "bg-slate-50 ") +
                          (isToday ? "!bg-sky-100 " : "")
                        }
                        style={{ width: DAY_WIDTH, height: SUMMARY_HEIGHT }}
                        title={`${s.occupancyPct}% (${s.sold}/${s.total})`}
                      >
                        <span className="font-semibold text-slate-800">{s.occupancyPct}%</span>
                        <span className="text-slate-500 text-[11px]">{s.sold}/{s.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
