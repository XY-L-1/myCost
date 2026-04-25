import { create } from "zustand";
import { keyValueStorage } from "../services/keyValueStorage";

export type AppLanguage = "en" | "zh-CN";
export type AppCurrency = "USD" | "CNY" | "EUR" | "JPY";

const LANGUAGE_KEY = "settings.language";
const CURRENCY_KEY = "settings.currency";

type SettingsState = {
  ready: boolean;
  language: AppLanguage;
  currency: AppCurrency;
  initialize: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setCurrency: (currency: AppCurrency) => Promise<void>;
};

function getDefaultLanguage(): AppLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith("zh") ? "zh-CN" : "en";
}

function getDefaultCurrency(language: AppLanguage): AppCurrency {
  return language === "zh-CN" ? "CNY" : "USD";
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ready: false,
  language: getDefaultLanguage(),
  currency: getDefaultCurrency(getDefaultLanguage()),
  initialize: async () => {
    const defaultLanguage = getDefaultLanguage();
    try {
      const [storedLanguage, storedCurrency] = await Promise.all([
        keyValueStorage.getItem(LANGUAGE_KEY),
        keyValueStorage.getItem(CURRENCY_KEY),
      ]);

      const language =
        storedLanguage === "en" || storedLanguage === "zh-CN"
          ? storedLanguage
          : defaultLanguage;

      const currency =
        storedCurrency === "USD" ||
        storedCurrency === "CNY" ||
        storedCurrency === "EUR" ||
        storedCurrency === "JPY"
          ? storedCurrency
          : getDefaultCurrency(language);

      set({
        ready: true,
        language,
        currency,
      });
    } catch (error) {
      console.error("[SETTINGS] initialization failed", error);
      set({
        ready: true,
        language: defaultLanguage,
        currency: getDefaultCurrency(defaultLanguage),
      });
    }
  },
  setLanguage: async (language) => {
    await keyValueStorage.setItem(LANGUAGE_KEY, language);
    set((state) => ({
      language,
      currency: state.currency ?? getDefaultCurrency(language),
    }));
  },
  setCurrency: async (currency) => {
    await keyValueStorage.setItem(CURRENCY_KEY, currency);
    set({ currency });
  },
}));
