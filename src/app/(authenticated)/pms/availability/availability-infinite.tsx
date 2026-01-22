"use client";

import * as React from "react";

import { AvailabilityCalendar } from "./availability-calendar";
import type { DateFormat } from "@/lib/dateFormat";
import { formatUtcDateOnly, parseDateOnlyToUtcMidnight } from "@/lib/pms/dates";

type Room = { id: string; name: string };

type Stay = {
  reservationId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  guestName?: string | null;
};

type Block = {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
};

type Props = {
  initialRooms: Room[];
  initialDates: string[];
  initialToExclusive: string;
  initialStays: Stay[];
  initialBlocks: Block[];
  canEditStays: boolean;
  dateFormat: DateFormat;
};

function addDays(dateOnly: string, days: number) {
  const d = parseDateOnlyToUtcMidnight(dateOnly);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateOnly(d);
}

function uniqueByKey<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function AvailabilityInfinite({
  initialRooms,
  initialDates,
  initialToExclusive,
  initialStays,
  initialBlocks,
  canEditStays,
  dateFormat,
}: Props) {
  const [rooms] = React.useState<Room[]>(initialRooms);
  const [dates, setDates] = React.useState<string[]>(initialDates);
  const [toExclusive, setToExclusive] = React.useState<string>(initialToExclusive);
  const [stays, setStays] = React.useState<Stay[]>(initialStays);
  const [blocks, setBlocks] = React.useState<Block[]>(initialBlocks);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const chunkDays = 30;
  const cellWidth = 56;
  const overscanDays = 7;

  const [renderWindow, setRenderWindow] = React.useState(() => ({
    startIndex: 0,
    endIndex: Math.min(initialDates.length, 60),
  }));

  const rafRef = React.useRef<number | null>(null);

  const updateRenderWindow = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const startIndex = Math.max(0, Math.floor(el.scrollLeft / cellWidth) - overscanDays);
    const endIndex = Math.min(
      dates.length,
      Math.ceil((el.scrollLeft + el.clientWidth) / cellWidth) + overscanDays,
    );

    setRenderWindow((prev) => {
      if (prev.startIndex === startIndex && prev.endIndex === endIndex) return prev;
      return { startIndex, endIndex };
    });
  }, [dates.length]);

  const loadMore = React.useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const from = toExclusive;
    const to = addDays(toExclusive, chunkDays);

    try {
      const res = await fetch(`/api/pms/availability?from=${from}&to=${to}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        let msg = "Unable to load more dates.";
        try {
          const j = (await res.json()) as any;
          msg = j?.error ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const json = (await res.json()) as any;

      // Append dates (API returns a full range, starting at `from`)
      const moreDates: string[] = Array.isArray(json.dates) ? json.dates : [];
      setDates((prev) => {
        const append = moreDates.slice(1); // drop the overlapping first date
        return prev.concat(append);
      });
      setToExclusive(to);

      // Merge stays/blocks
      const roomRows: any[] = Array.isArray(json.rooms) ? json.rooms : [];
      const incomingStays: Stay[] = [];
      const incomingBlocks: Block[] = [];

      for (const r of roomRows) {
        const roomId = String(r.id);
        for (const s of (r.stays ?? []) as any[]) {
          incomingStays.push({
            reservationId: String(s.id),
            roomId,
            startDate: String(s.startDate),
            endDate: String(s.endDate),
            guestName: (s.guestName ?? null) as any,
          });
        }
        for (const b of (r.blocks ?? []) as any[]) {
          incomingBlocks.push({
            id: String(b.id),
            roomId,
            startDate: String(b.startDate),
            endDate: String(b.endDate),
            reason: (b.reason ?? null) as any,
          });
        }
      }

      setStays((prev) =>
        uniqueByKey(prev.concat(incomingStays), (s) => `${s.reservationId}:${s.roomId}`),
      );
      setBlocks((prev) => uniqueByKey(prev.concat(incomingBlocks), (b) => b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load more dates.");
    } finally {
      setLoading(false);
    }
  }, [loading, toExclusive]);

  // If the initial range fits entirely (no horizontal scroll), keep extending until
  // the timeline actually overflows and becomes scrollable.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loading) return;

    // If there's no horizontal overflow, add more days.
    if (el.scrollWidth <= el.clientWidth + 1) {
      void loadMore();
    }
  }, [dates.length, loading, loadMore]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateRenderWindow();
        rafRef.current = null;
      });

      // When close to the right edge, append another chunk.
      const threshold = 300;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - threshold) {
        void loadMore();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore, updateRenderWindow]);

  React.useEffect(() => {
    updateRenderWindow();
  }, [dates.length, updateRenderWindow]);

  return (
    <div className="space-y-2">
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="h-[70vh] w-full border rounded-lg overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full w-full overflow-x-auto overflow-y-auto overscroll-contain"
          tabIndex={0}
        >
          <AvailabilityCalendar
            rooms={rooms}
            dates={dates}
            toExclusive={toExclusive}
            stays={stays}
            blocks={blocks}
            canEditStays={canEditStays}
            dateFormat={dateFormat}
            renderWindow={renderWindow}
          />
        </div>
      </div>

      {loading ? <div className="text-sm text-black/60">Loading more…</div> : null}
    </div>
  );
}
