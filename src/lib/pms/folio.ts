import type { PaymentStatus } from "@prisma/client";

export type FolioTotals = {
  subtotalCents: number;
  paidCents: number;
  balanceCents: number;
  paymentStatus: PaymentStatus;
};

export function computeFolioTotals(lines: Array<{ type: string; amountCents: number }>): FolioTotals {
  let balanceCents = 0;
  let paidCents = 0;

  for (const line of lines) {
    balanceCents += line.amountCents;
    if (line.type === "PAYMENT") {
      paidCents += -line.amountCents;
    }
  }

  const subtotalCents = balanceCents + paidCents;

  let paymentStatus: PaymentStatus;
  if (subtotalCents <= 0) {
    paymentStatus = "PAID";
  } else if (paidCents <= 0) {
    paymentStatus = "UNPAID";
  } else if (balanceCents > 0) {
    paymentStatus = "PARTIALLY_PAID";
  } else {
    paymentStatus = "PAID";
  }

  return {
    subtotalCents,
    paidCents,
    balanceCents,
    paymentStatus,
  };
}
