import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateOnlyFromDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireActivePropertyScope } from "@/lib/propertyScope";
import { getFolioSummary, getStayDetails, type StayStatus } from "@/lib/pms/stays";
import { getCurrentUserDateFormat } from "@/lib/userPreferences";

import { updateStayDates, updateStayNotes, updateStayRoom, updateStayStatus } from "../actions";
import { addCharge, postRoomCharges, recordPayment, reverseLine } from "../folioActions";

export const dynamic = "force-dynamic";

export default async function StayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activePropertyId, role } = await requireActivePropertyScope();
  const dateFormat = await getCurrentUserDateFormat();
  const { id } = await params;

  const sp = await searchParams;
  const errorParam = typeof sp.error === "string" ? sp.error : "";
  const datesErrorParam = typeof sp.datesError === "string" ? sp.datesError : "";
  const roomErrorParam = typeof sp.roomError === "string" ? sp.roomError : "";

  const stay = await getStayDetails({ propertyId: activePropertyId, reservationId: id });
  const summary = await getFolioSummary({ propertyId: activePropertyId, reservationId: id });

  const subtitle = (() => {
    const parts: string[] = [];
    if (stay.guestName) parts.push(stay.guestName);

    const start = stay.startDate
      ? formatDateOnlyFromDate(new Date(`${stay.startDate}T00:00:00.000Z`), dateFormat)
      : "";
    const end = stay.endDate
      ? formatDateOnlyFromDate(new Date(`${stay.endDate}T00:00:00.000Z`), dateFormat)
      : "";

    if (start || end) {
      parts.push(start && end ? `${start} → ${end}` : start || end);
    }

    return parts.join(" • ");
  })();

  const rooms = await prisma.room.findMany({
    where: { propertyId: activePropertyId, isActive: true, status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      roomType: { select: { code: true } },
    },
  });

  const canManage = role === "OWNER" || role === "MANAGER";
  const canPayments = role === "OWNER" || role === "MANAGER";

  const lines = stay.folio?.lines ?? [];
  type LineRow = (typeof lines)[number];

  const reversedSet = new Set<string>();
  for (const l of lines) {
    if (l.reversalOfLineId) reversedSet.add(l.reversalOfLineId);
  }

  const nights = (() => {
    const start = new Date(`${stay.startDate}T00:00:00.000Z`);
    const end = new Date(`${stay.endDate}T00:00:00.000Z`);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  })();

  const charges = lines.filter((l) => l.type !== "PAYMENT");
  const payments = lines.filter((l) => l.type === "PAYMENT");

  const canManageStatus = canManage;

  const allowedTransitions = (() => {
    const from = stay.status as StayStatus;
    if (from === "DRAFT") return ["CONFIRMED", "CANCELLED"] as const;
    if (from === "CONFIRMED") return ["CHECKED_IN", "CANCELLED", "NO_SHOW"] as const;
    if (from === "CHECKED_IN") return ["CHECKED_OUT"] as const;
    return [] as const;
  })();

  return (
    <main className="p-6">
      <PageHeader
        title="Stay details"
        subtitle={subtitle}
        actions={
          <>
            <Button href="/pms/stays" variant="ghost">
              ← Stays
            </Button>
            <Button href="/pms/availability" variant="ghost">
              Availability →
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {errorParam ? (
          <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errorParam}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Guest</div>
                <div className="font-medium">
                  {stay.guestId ? (
                    <Button
                      href={`/pms/guests/${stay.guestId}`}
                      variant="ghost"
                      className="px-2 py-1 -ml-2"
                    >
                      {stay.guestName}
                    </Button>
                  ) : (
                    stay.guestName
                  )}
                </div>
                {stay.guestEmail ? <div className="text-sm">{stay.guestEmail}</div> : null}
              </div>

              <div>
                <div className="text-xs text-slate-500">Room</div>
                <div className="font-medium">{stay.room.name}</div>
                <div className="text-sm text-slate-600">{stay.roomType.code}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="font-medium">{stay.status}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Payment status</div>
                <div className="font-medium">{summary.paymentStatus ?? stay.paymentStatus}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Channel</div>
                <div className="font-medium">{stay.channel ?? "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {canManageStatus ? (
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((to) => (
                  <form key={to} action={updateStayStatus.bind(null, id, to)}>
                    <Button type="submit">Mark {to}</Button>
                  </form>
                ))}
                {allowedTransitions.length === 0 ? (
                  <div className="text-sm text-black/70">No transitions available.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Folio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Subtotal</div>
                <div className="font-medium">
                  {formatMoney(summary.subtotalCents ?? summary.chargesCents, summary.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Paid</div>
                <div className="font-medium">
                  {formatMoney(summary.paidCents ?? summary.paymentsCents, summary.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Balance</div>
                <div className="font-medium">{formatMoney(summary.balanceCents, summary.currency)}</div>
              </div>
            </div>

            {canManage ? (
              <div className="flex flex-wrap gap-6">
                <form action={addCharge} className="flex flex-wrap gap-2 items-end">
                  <input type="hidden" name="stayId" value={id} />
                  <div className="flex flex-col">
                    <label className="text-sm">Type</label>
                    <select
                      name="itemType"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="ROOM">ROOM</option>
                      <option value="SERVICE">SERVICE</option>
                      <option value="POS">POS</option>
                      <option value="ADJUSTMENT">ADJUSTMENT</option>
                      <option value="TAX">TAX</option>
                      <option value="DISCOUNT">DISCOUNT</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm">Description</label>
                    <input name="description" className="border px-2 py-1" placeholder="Mini-bar" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm">Qty</label>
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      defaultValue={1}
                      className="border px-2 py-1 w-20"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm">Unit price</label>
                    <input name="unitPrice" type="number" step="0.01" className="border px-2 py-1 w-32" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm">Date</label>
                    <input name="serviceDate" type="date" className="border px-2 py-1" />
                  </div>
                  <Button type="submit">Add charge</Button>
                </form>

                {canPayments ? (
                  <form action={recordPayment} className="flex flex-wrap gap-2 items-end">
                    <input type="hidden" name="stayId" value={id} />
                    <div className="flex flex-col">
                      <label className="text-sm">Method</label>
                      <select
                        name="method"
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                      >
                        <option value="CASH">CASH</option>
                        <option value="CARD">CARD</option>
                        <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                        <option value="ONLINE">ONLINE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm">Amount</label>
                      <input name="amount" type="number" step="0.01" className="border px-2 py-1 w-32" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm">Reference</label>
                      <input name="reference" className="border px-2 py-1" placeholder="Optional" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm">Notes</label>
                      <input name="notes" className="border px-2 py-1" placeholder="Optional" />
                    </div>
                    <Button type="submit">Record payment</Button>
                  </form>
                ) : null}

                <form action={postRoomCharges}>
                  <input type="hidden" name="stayId" value={id} />
                  <Button type="submit">Post room charges ({nights} nights)</Button>
                </form>
              </div>
            ) : (
              <div className="text-sm text-black/70">Read-only.</div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Charges</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">Total</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((l: LineRow) => {
                        const canReverse = canManage && l.type !== "REVERSAL" && !reversedSet.has(l.id);
                        return (
                          <tr key={l.id} className="border-b">
                            <td className="py-2 whitespace-nowrap">{formatDateOnlyFromDate(l.postedAt, dateFormat)}</td>
                            <td className="py-2 whitespace-nowrap">{l.type}</td>
                            <td className="py-2">{l.description ?? ""}</td>
                            <td className="py-2 whitespace-nowrap">{formatMoney(l.amountCents, l.currency)}</td>
                            <td className="py-2">
                              {canReverse ? (
                                <form action={reverseLine}>
                                  <input type="hidden" name="stayId" value={id} />
                                  <input type="hidden" name="lineId" value={l.id} />
                                  <Button variant="ghost" className="px-2 py-1" type="submit">
                                    Reverse
                                  </Button>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2">Date</th>
                        <th className="py-2">Method/Notes</th>
                        <th className="py-2">Amount</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((l: LineRow) => {
                        const canReverse = canManage && l.type !== "REVERSAL" && !reversedSet.has(l.id);
                        return (
                          <tr key={l.id} className="border-b">
                            <td className="py-2 whitespace-nowrap">{formatDateOnlyFromDate(l.postedAt, dateFormat)}</td>
                            <td className="py-2">{l.description ?? ""}</td>
                            <td className="py-2 whitespace-nowrap">{formatMoney(-l.amountCents, l.currency)}</td>
                            <td className="py-2">
                              {canReverse ? (
                                <form action={reverseLine}>
                                  <input type="hidden" name="stayId" value={id} />
                                  <input type="hidden" name="lineId" value={l.id} />
                                  <Button variant="ghost" className="px-2 py-1" type="submit">
                                    Reverse
                                  </Button>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Change dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {datesErrorParam ? (
                    <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
                      {datesErrorParam}
                    </div>
                  ) : null}

                  <form action={updateStayDates} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="stayId" value={id} />

                    <div className="flex flex-col">
                      <label className="text-sm">Check-in</label>
                      <input
                        name="checkInDate"
                        type="date"
                        className="border px-2 py-1"
                        defaultValue={stay.startDate}
                        required
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-sm">Check-out</label>
                      <input
                        name="checkOutDate"
                        type="date"
                        className="border px-2 py-1"
                        defaultValue={stay.endDate}
                        required
                      />
                    </div>

                    <Button type="submit">Update dates</Button>
                  </form>

                  <div className="text-xs text-black/60">
                    Note: Room charges are not automatically recalculated. Use “Post room charges” after changes if needed.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Move room</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roomErrorParam ? (
                    <div className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-900">
                      {roomErrorParam}
                    </div>
                  ) : null}

                  <form action={updateStayRoom} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="stayId" value={id} />

                    <div className="flex flex-col">
                      <label className="text-sm">Room</label>
                      <select
                        name="newRoomId"
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                        defaultValue={stay.room.id}
                        required
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.roomType.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button type="submit">Update room</Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={updateStayNotes.bind(null, id)} className="space-y-2">
                    <textarea
                      name="notes"
                      className="w-full border px-2 py-1"
                      rows={3}
                      defaultValue={stay.notes ?? ""}
                      placeholder="Optional"
                    />
                    <Button type="submit">Save notes</Button>
                  </form>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
