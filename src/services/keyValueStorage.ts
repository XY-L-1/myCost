import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memoryStorage = new Map<string, string>();

function getWebStorage(): Storage | null {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const keyValueStorage = {
  async getItem(key: string): Promise<string | null> {
    const webStorage = getWebStorage();
    if (webStorage) {
      return webStorage.getItem(key);
    }

    if (Platform.OS === "web") {
      return memoryStorage.get(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.setItem(key, value);
      return;
    }

    if (Platform.OS === "web") {
      memoryStorage.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    const webStorage = getWebStorage();
    if (webStorage) {
      webStorage.removeItem(key);
      return;
    }

    if (Platform.OS === "web") {
      memoryStorage.delete(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};
