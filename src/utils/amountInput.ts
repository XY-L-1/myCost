export function formatAmountInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function parseAmountInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function applyAmountInputChange(
  currentAmountCents: number,
  nextValue: string
): number {
  const currentValue = formatAmountInput(currentAmountCents);

  let prefixLength = 0;
  while (
    prefixLength < currentValue.length &&
    prefixLength < nextValue.length &&
    currentValue[prefixLength] === nextValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < currentValue.length - prefixLength &&
    suffixLength < nextValue.length - prefixLength &&
    currentValue[currentValue.length - suffixLength - 1] ===
      nextValue[nextValue.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const removedDigits = currentValue
    .slice(prefixLength, currentValue.length - suffixLength)
    .replace(/\D/g, "");
  const insertedDigits = nextValue
    .slice(prefixLength, nextValue.length - suffixLength)
    .replace(/\D/g, "");

  const replacesWholeValue = prefixLength === 0 && suffixLength === 0;
  if (insertedDigits && removedDigits && replacesWholeValue) {
    return parseAmountInput(nextValue);
  }

  if (insertedDigits) {
    return Number(`${currentAmountCents}${insertedDigits}`);
  }

  if (removedDigits) {
    return Math.floor(currentAmountCents / 10 ** removedDigits.length);
  }

  return currentAmountCents;
}
