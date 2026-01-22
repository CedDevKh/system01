export function formatMoney(amountCents: number, currency: string) {
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    const abs = Math.abs(amountCents);
    const sign = amountCents < 0 ? "-" : "";
    const major = (abs / 100).toFixed(2);
    return `${sign}${major} ${currency}`;
  }
}
