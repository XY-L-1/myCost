import { useMemo } from "react";
import { useI18n } from "../i18n/i18n";
import { useSettingsStore } from "../settings/settingsStore";
import {
  formatCurrency as formatCurrencyValue,
  formatDate as formatDateValue,
  formatMonthLabel,
} from "../utils/formatting";

export function useFormatters() {
  const { language } = useI18n();
  const currency = useSettingsStore((state) => state.currency);

  return useMemo(
    () => ({
      formatCurrency: (amountCents: number, overrideCurrency?: string) =>
        formatCurrencyValue(amountCents, language, overrideCurrency ?? currency),
      formatDate: (dateKey: string, options?: Intl.DateTimeFormatOptions) =>
        formatDateValue(dateKey, language, options),
      formatMonth: (monthKey: string) => formatMonthLabel(monthKey, language),
    }),
    [currency, language]
  );
}
