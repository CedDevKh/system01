"use client";

import * as React from "react";

import type {
  AvailabilityResponse,
  AvailabilityRoom,
  AvailabilityStay,
  AvailabilityBlock,
  AvailabilityOccupancy,
  DailySummary,
  RoomStatusFilter,
  ViewDays,
} from "./types";
import { formatUtcDateOnly, parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

function addDays(dateOnly: string, days: number): string {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateOnly(d);
}

function todayUtcDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeDailySummary(dates: string[], rooms: AvailabilityRoom[]): DailySummary[] {
  const total = rooms.length;
  return dates.map((date, i) => {
    let sold = 0;
    for (const r of rooms) {
      if ((r.occupancy[i] ?? "") !== "") sold += 1;
    }
    const occupancyPct = total === 0 ? 0 : Math.round((sold / total) * 100);
    return { date, sold, total, occupancyPct, adrCents: null };
  });
}

function extractErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  if (!("error" in json)) return null;
  const errorValue = (json as { error?: unknown }).error;
  return typeof errorValue === "string" ? errorValue : null;
}

export type AvailabilityUiState = {
  from: string;
  viewDays: ViewDays;
  roomTypeId: string | null;
  roomStatusFilter: RoomStatusFilter;
};

type RoomData = AvailabilityResponse["rooms"][number];

function mergeUniqueById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of a) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  for (const item of b) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function mergeAvailabilityAppend(existing: AvailabilityResponse, incoming: AvailabilityResponse): AvailabilityResponse {
  const lastExisting = existing.dates[existing.dates.length - 1] ?? "";
  const keepDates = incoming.dates.filter((d) => (lastExisting ? d > lastExisting : true));
  if (keepDates.length === 0) return existing;

  const dropCount = incoming.dates.length - keepDates.length;
  const nextDates = existing.dates.concat(keepDates);

  const incomingByRoom = new Map<string, RoomData>();
  for (const r of incoming.rooms) incomingByRoom.set(r.id, r);

  const mergedRooms: RoomData[] = existing.rooms.map((r) => {
    const inc = incomingByRoom.get(r.id);
    if (!inc) {
      return {
        ...r,
        occupancy: r.occupancy.concat(new Array(keepDates.length).fill("")),
      };
    }

    return {
      ...r,
      // keep latest status/housekeeping info if it changed
      status: inc.status,
      housekeepingStatus: inc.housekeepingStatus,
      roomType: inc.roomType,
      stays: mergeUniqueById(r.stays, inc.stays),
      blocks: mergeUniqueById(r.blocks, inc.blocks),
      occupancy: r.occupancy.concat(inc.occupancy.slice(dropCount)),
    };
  });

  return {
    from: existing.from,
    to: incoming.to,
    dates: nextDates,
    rooms: mergedRooms,
  };
}

function initialLoadDays(viewDays: ViewDays): number {
  // Keep an initial buffer beyond the "view" so horizontal scrolling feels natural.
  return Math.max(60, viewDays * 2);
}

// Keep a small amount of history so the timeline can scroll left.
const PAST_DAYS_BUFFER = 14;

export function useAvailabilityData(
  initial: AvailabilityResponse,
  initialFrom: string,
  initialViewDays: ViewDays,
) {
  const [data, setData] = React.useState<AvailabilityResponse>(initial);
  const [loading, setLoading] = React.useState(false);
  const [extending, setExtending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const extendLockRef = React.useRef(false);
  const lastRequestedFromRef = React.useRef<string | null>(null);
  const lastDateRef = React.useRef<string | null>(null);
  const dataFromRef = React.useRef<string>(initial.from);
  const dataToRef = React.useRef<string>(initial.to);
  const roomsByIdRef = React.useRef<Map<string, AvailabilityRoom>>(new Map());
  const dateToIndexRef = React.useRef<Map<string, number>>(new Map());

  React.useEffect(() => {
    lastDateRef.current = data.dates[data.dates.length - 1] ?? null;
    dataFromRef.current = data.from;
    dataToRef.current = data.to;

    const roomMap = new Map<string, AvailabilityRoom>();
    for (const r of data.rooms) roomMap.set(r.id, r);
    roomsByIdRef.current = roomMap;

    const dateMap = new Map<string, number>();
    data.dates.forEach((d, i) => dateMap.set(d, i));
    dateToIndexRef.current = dateMap;
  }, [data.dates]);

  const [ui, setUi] = React.useState<AvailabilityUiState>({
    from: initialFrom,
    viewDays: initialViewDays,
    roomTypeId: null,
    roomStatusFilter: "ALL",
  });

  const to = React.useMemo(() => addDays(ui.from, ui.viewDays), [ui.from, ui.viewDays]);

  const rangeCovered = React.useCallback((from: string, to: string): boolean => {
    // Date-only strings are lexicographically sortable in YYYY-MM-DD format.
    const loadedFrom = dataFromRef.current;
    const loadedTo = dataToRef.current;
    return loadedFrom <= from && loadedTo >= to;
  }, []);

  const refresh = React.useCallback(async () => {
    const fetchFrom = dataFromRef.current;
    const fetchTo = dataToRef.current;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pms/availability?from=${fetchFrom}&to=${fetchTo}`, { cache: "no-store" });
      if (!res.ok) {
        let msg = "Unable to refresh availability.";
        try {
          const j: unknown = await res.json();
          msg = extractErrorMessage(j) ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as AvailabilityResponse;
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to refresh availability.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetWindow = React.useCallback(async (nextFrom: string, nextViewDays: ViewDays) => {
    const loadDays = initialLoadDays(nextViewDays);
    // Always include some past days so users can scroll left.
    const fetchFrom = addDays(nextFrom, -PAST_DAYS_BUFFER);
    const fetchTo = addDays(nextFrom, loadDays);

    // If we already have the requested range in memory, avoid refetching/resetting.
    if (rangeCovered(fetchFrom, fetchTo)) {
      setUi((prev) => ({ ...prev, from: nextFrom, viewDays: nextViewDays }));
      return;
    }

    // If we're moving within/after the loaded range, extend the timeline (append) instead of resetting.
    if (dataToRef.current < fetchTo && dataFromRef.current <= fetchFrom) {
      setUi((prev) => ({ ...prev, from: nextFrom, viewDays: nextViewDays }));
      // Extend in 30-day chunks until the requested end is covered.
      let safety = 0;
      while (!rangeCovered(fetchFrom, fetchTo) && safety < 24) {
        // eslint-disable-next-line no-await-in-loop
        await extendRight();
        safety += 1;
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/pms/availability?from=${fetchFrom}&to=${fetchTo}`, { cache: "no-store" });
      if (!res.ok) {
        let msg = "Unable to load availability.";
        try {
          const j: unknown = await res.json();
          msg = extractErrorMessage(j) ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as AvailabilityResponse;
      setData(json);
      setUi((prev) => ({ ...prev, from: nextFrom, viewDays: nextViewDays }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  const goPrev = React.useCallback(() => {
    const nextFrom = addDays(ui.from, -ui.viewDays);
    void resetWindow(nextFrom, ui.viewDays);
  }, [resetWindow, ui.from, ui.viewDays]);

  const goNext = React.useCallback(() => {
    const nextFrom = addDays(ui.from, ui.viewDays);
    void resetWindow(nextFrom, ui.viewDays);
  }, [resetWindow, ui.from, ui.viewDays]);

  const goToday = React.useCallback(() => {
    void resetWindow(todayUtcDateOnly(), ui.viewDays);
  }, [resetWindow, ui.viewDays]);

  const setViewDays = React.useCallback(
    (viewDays: ViewDays) => {
      void resetWindow(ui.from, viewDays);
    },
    [resetWindow, ui.from],
  );

  const extendRight = React.useCallback(async () => {
    if (extendLockRef.current) return;

    const last = lastDateRef.current;
    if (!last) return;

    // Add more dates in 30-day chunks.
    const nextFrom = addDays(last, 1);
    const nextTo = addDays(nextFrom, 30);

    if (lastRequestedFromRef.current === nextFrom) return;
    lastRequestedFromRef.current = nextFrom;

    extendLockRef.current = true;
    setExtending(true);
    setError(null);

    try {
      const res = await fetch(`/api/pms/availability?from=${nextFrom}&to=${nextTo}`, { cache: "no-store" });
      if (!res.ok) {
        let msg = "Unable to load more dates.";
        try {
          const j: unknown = await res.json();
          msg = extractErrorMessage(j) ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as AvailabilityResponse;
      setData((prev) => mergeAvailabilityAppend(prev, json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load more dates.");
    } finally {
      extendLockRef.current = false;
      setExtending(false);
    }
  }, []);


  const getOccupancy = React.useCallback((roomId: string, dateOnly: string): AvailabilityOccupancy => {
    const r = roomsByIdRef.current.get(roomId);
    if (!r) return "";
    const idx = dateToIndexRef.current.get(dateOnly);
    if (idx == null) return "";
    return r.occupancy[idx] ?? "";
  }, []);

  const getReservations = React.useCallback((roomId: string, from: string, to: string): AvailabilityStay[] => {
    const r = roomsByIdRef.current.get(roomId);
    if (!r) return [];
    return r.stays.filter((s) => s.startDate < to && s.endDate > from);
  }, []);

  const getBlocks = React.useCallback((roomId: string, from: string, to: string): AvailabilityBlock[] => {
    const r = roomsByIdRef.current.get(roomId);
    if (!r) return [];
    return r.blocks.filter((b) => b.startDate < to && b.endDate > from);
  }, []);

  const filteredRooms = React.useMemo(() => {
    return data.rooms.filter((r) => {
      if (ui.roomTypeId && r.roomType.id !== ui.roomTypeId) return false;
      if (ui.roomStatusFilter === "OUT_OF_ORDER") return r.status === "OUT_OF_ORDER";
      if (ui.roomStatusFilter === "CLEAN") return r.housekeepingStatus === "CLEAN";
      if (ui.roomStatusFilter === "DIRTY") return r.housekeepingStatus === "DIRTY";
      return true;
    });
  }, [data.rooms, ui.roomStatusFilter, ui.roomTypeId]);

  const roomTypes = React.useMemo(() => {
    const byId = new Map<string, { id: string; code: string; name: string }>();
    for (const r of data.rooms) byId.set(r.roomType.id, r.roomType);
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.rooms]);

  const summary = React.useMemo(() => computeDailySummary(data.dates, filteredRooms), [data.dates, filteredRooms]);

  return {
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
    resetWindow,
    refresh,
    extendRight,
    extending,
    getOccupancy,
    getReservations,
    getBlocks,
  };
}
