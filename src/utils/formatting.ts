import { AppCurrency } from "../settings/settingsStore";

export function formatCurrency(
  amountCents: number,
  locale: string,
  currency: AppCurrency | string
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatDate(
  dateKey: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat(locale, options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatRelativeSyncTime(
  isoString: string | null,
  locale: string
) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
