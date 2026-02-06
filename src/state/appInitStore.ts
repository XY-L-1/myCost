import { create } from "zustand";
import { runMigrations } from "../db/migration";
import { seedCategoriesIfNeeded } from "../db/seedCategories";
import * as SecureStore from "expo-secure-store";
import { generateUUID } from "../utils/uuid";

/**
 * AppInitState
 *
 * Manages the lifecycle of application startup.
 * This store is responsible for preparing the local system
 * before any UI or business logic runs.
 */
type AppInitState = {
   ready: boolean;
   initializing: boolean;
   error: string | null;

   /**
      * initialize
      *
      * Entry point for app startup.
      * - Runs database migrations
      * - Ensures deviceId exists
      * - Seeds default categories if needed
      */
   initialize: () => Promise<void>;
};

/**
 * getDeviceId
 *
 * Returns a stable, device-specific identifier.
 * This ID is used later for sync conflict resolution.
 */
async function getDeviceId(): Promise<string> {
   const existing = await SecureStore.getItemAsync("deviceId");
   if (existing) return existing;

   const id = await generateUUID();
   await SecureStore.setItemAsync("deviceId", id);
   return id;
}

export const useAppInitStore = create<AppInitState>((set) => ({
   ready: false,
   initializing: false,
   error: null,

   initialize: async () => {
      try {
         set({ initializing: true, error: null });

         // 1. Ensure database schema is up to date
         await runMigrations();

         // 2. Ensure deviceId exists
         const deviceId = await getDeviceId();

         // 3. Seed default categories (runs only once)
         await seedCategoriesIfNeeded(deviceId);

         // Mark app as ready
         set({ ready: true, initializing: false });
      } catch (e) {
         console.error("App initialization failed", e);
         set({
         error: "Failed to initialize app",
         initializing: false,
         });
      }
   },
}));