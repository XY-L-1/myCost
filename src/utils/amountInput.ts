export function formatAmountInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function parseAmountInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
