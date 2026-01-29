"use client";

import * as React from "react";

import type { AvailabilityRoom, AvailabilityStay, StayStatus } from "./types";
import { Button } from "@/components/ui/button";

type DrawerMode =
  | { kind: "closed" }
  | { kind: "stay"; reservationId: string }
  | { kind: "new"; roomId: string; startDate: string; endDate: string };

type StayDetails = {
  id: string;
  status: StayStatus;
  guestName: string;
  guestEmail: string | null;
  source: "MANUAL" | "DIRECT";
  channel: string | null;
  notes: string | null;
  startDate: string;
  endDate: string;
  room: { id: string; name: string } | null;
};

type Props = {
  mode: DrawerMode;
  onClose: () => void;
  canManageReservations: boolean;
  rooms: AvailabilityRoom[];
  onCreated: (reservationId: string) => void;
};

async function fetchStayDetails(reservationId: string): Promise<StayDetails> {
  const res = await fetch(`/api/pms/stays/${reservationId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Unable to load stay.");
  const json: unknown = await res.json();

  const stay =
    typeof json === "object" && json && "stay" in json
      ? (json as { stay?: unknown }).stay
      : undefined;

  const obj = typeof stay === "object" && stay ? (stay as Record<string, unknown>) : null;

  const id = typeof obj?.id === "string" ? obj.id : reservationId;
  const status = (typeof obj?.status === "string" ? obj.status : "DRAFT") as StayStatus;
  const guestName = typeof obj?.guestName === "string" ? obj.guestName : "";
  const guestEmail = typeof obj?.guestEmail === "string" ? obj.guestEmail : null;
  const source = (typeof obj?.source === "string" ? obj.source : "MANUAL") as "MANUAL" | "DIRECT";
  const channel = typeof obj?.channel === "string" ? obj.channel : null;
  const notes = typeof obj?.notes === "string" ? obj.notes : null;
  const startDate = typeof obj?.startDate === "string" ? obj.startDate : "";
  const endDate = typeof obj?.endDate === "string" ? obj.endDate : "";

  const roomRaw = obj?.room;
  const roomObj = typeof roomRaw === "object" && roomRaw ? (roomRaw as Record<string, unknown>) : null;
  const room =
    roomObj && typeof roomObj.id === "string" && typeof roomObj.name === "string"
      ? { id: roomObj.id, name: roomObj.name }
      : null;

  return {
    id,
    status,
    guestName,
    guestEmail,
    source,
    channel,
    notes,
    startDate,
    endDate,
    room,
  };
}

function actionButtonsForStatus(status: StayStatus): Array<{ label: string; action: "CONFIRM" | "CHECK_IN" | "CHECK_OUT" | "CANCEL" }> {
  if (status === "DRAFT") return [{ label: "Confirm", action: "CONFIRM" }, { label: "Cancel", action: "CANCEL" }];
  if (status === "CONFIRMED") return [{ label: "Check in", action: "CHECK_IN" }, { label: "Cancel", action: "CANCEL" }];
  if (status === "CHECKED_IN") return [{ label: "Check out", action: "CHECK_OUT" }];
  return [];
}

export function ReservationDrawer({ mode, onClose, canManageReservations, rooms, onCreated }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stay, setStay] = React.useState<StayDetails | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (mode.kind !== "stay") {
      setStay(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchStayDetails(mode.reservationId)
      .then((s) => {
        if (cancelled) return;
        setStay(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unable to load stay.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function runStatusAction(action: "CONFIRM" | "CHECK_IN" | "CHECK_OUT" | "CANCEL") {
    if (!stay) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pms/stays/${stay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Unable to update status.");
      const json: unknown = await res.json();

      const nextStay =
        typeof json === "object" && json && "stay" in json
          ? (json as { stay?: unknown }).stay
          : undefined;
      const nextObj = typeof nextStay === "object" && nextStay ? (nextStay as Record<string, unknown>) : null;
      const nextStatus = (typeof nextObj?.status === "string" ? nextObj.status : stay.status) as StayStatus;

      setStay((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setLoading(false);
    }
  }

  async function createReservation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode.kind !== "new") return;
    if (!canManageReservations) return;

    const form = new FormData(e.currentTarget);
    const roomId = String(form.get("roomId") ?? "");
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    const guestName = String(form.get("guestName") ?? "");
    const guestEmail = String(form.get("guestEmail") ?? "").trim() || undefined;
    const source = (String(form.get("source") ?? "MANUAL") as "MANUAL" | "DIRECT");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pms/stays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, startDate, endDate, guestName, guestEmail, source }),
      });
      if (!res.ok) {
        let msg = "Unable to create reservation.";
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

      const json: unknown = await res.json();
      const createdStay =
        typeof json === "object" && json && "stay" in json
          ? (json as { stay?: unknown }).stay
          : undefined;
      const createdObj = typeof createdStay === "object" && createdStay ? (createdStay as Record<string, unknown>) : null;
      const reservationId = typeof createdObj?.id === "string" ? createdObj.id : "";
      if (!reservationId) throw new Error("Created, but missing id.");
      onCreated(reservationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create reservation.");
    } finally {
      setLoading(false);
    }
  }

  if (mode.kind === "closed") return null;

  return (
    <aside className="fixed right-0 top-0 z-50 h-full w-[420px] border-l border-border bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="font-medium">
          {mode.kind === "stay" ? "Reservation" : "New reservation"}
        </div>
        <Button variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {mode.kind === "stay" ? (
          loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : stay ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Guest</div>
                <div className="font-medium">{stay.guestName}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="font-medium">{stay.status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Room</div>
                  <div className="font-medium">{stay.room?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Start</div>
                  <div className="font-medium">{stay.startDate}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">End</div>
                  <div className="font-medium">{stay.endDate}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {actionButtonsForStatus(stay.status).map((b) => (
                  <Button
                    key={b.action}
                    variant={b.action === "CANCEL" ? "secondary" : "primary"}
                    onClick={() => runStatusAction(b.action)}
                    disabled={!canManageReservations || loading}
                    title={canManageReservations ? "" : "Only OWNER/MANAGER can edit"}
                  >
                    {b.label}
                  </Button>
                ))}
                <Button variant="ghost" href={`/pms/stays/${stay.id}`}>
                  Open full page →
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Not found.</div>
          )
        ) : (
          <form className="space-y-3" onSubmit={createReservation}>
            <div>
              <label className="text-sm text-muted-foreground">Room</label>
              <select
                name="roomId"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                defaultValue={mode.roomId}
                required
                disabled={!canManageReservations}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Start</label>
                <input
                  name="startDate"
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  defaultValue={mode.startDate}
                  required
                  disabled={!canManageReservations}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">End</label>
                <input
                  name="endDate"
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  defaultValue={mode.endDate}
                  required
                  disabled={!canManageReservations}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Guest name</label>
              <input
                name="guestName"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Guest name"
                required
                disabled={!canManageReservations}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Guest email (optional)</label>
              <input
                name="guestEmail"
                type="email"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="guest@example.com"
                disabled={!canManageReservations}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Source</label>
              <select
                name="source"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                defaultValue="MANUAL"
                disabled={!canManageReservations}
              >
                <option value="MANUAL">Manual</option>
                <option value="DIRECT">Direct</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" type="submit" disabled={!canManageReservations || loading}>
                Create
              </Button>
              {!canManageReservations ? (
                <div className="text-sm text-muted-foreground">Only OWNER/MANAGER can create.</div>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}

export type { DrawerMode };
