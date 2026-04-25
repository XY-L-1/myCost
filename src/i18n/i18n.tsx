import { createContext, useContext, useMemo } from "react";
import { useSettingsStore } from "../settings/settingsStore";
import { resources } from "./resources";

type I18nContextValue = {
  language: keyof typeof resources;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveValue(
  language: keyof typeof resources,
  key: string
): string | undefined {
  const parts = key.split(".");
  let cursor: unknown = resources[language];

  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return typeof cursor === "string" ? cursor : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;

  return template.replace(/\{\{(.*?)\}\}/g, (_, rawKey: string) => {
    const value = params[rawKey.trim()];
    return value === undefined ? "" : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((state) => state.language);

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      t: (key, params) => {
        const text =
          resolveValue(language, key) ??
          resolveValue("en", key) ??
          key;
        return interpolate(text, params);
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
