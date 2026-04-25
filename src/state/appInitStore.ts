import { create } from "zustand";
import { runMigrations } from "../db/migration";
import { generateUUID } from "../utils/uuid";
import { keyValueStorage } from "../services/keyValueStorage";

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
   deviceId: string | null;

   /**
      * initialize
      *
      * Entry point for app startup.
      * - Runs database migrations
      * - Ensures deviceId exists
      * - Defers category seeding until after auth sync
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
   const existing = await keyValueStorage.getItem("deviceId");
   if (existing) return existing;

   const id = await generateUUID();
   await keyValueStorage.setItem("deviceId", id);
   return id;
}

export const useAppInitStore = create<AppInitState>((set) => ({
   ready: false,
   initializing: false,
   error: null,
   deviceId: null,

   initialize: async () => {
      try {
         set({ initializing: true, error: null });

         // 1. Ensure database schema is up to date
         await runMigrations();

         // 2. Ensure deviceId exists
         const deviceId = await getDeviceId();

         // Mark app as ready
         set({ ready: true, initializing: false, deviceId });
      } catch (e) {
         console.error("App initialization failed", e);
         set({
         error: "errors.initFailed",
         initializing: false,
         });
      }
   },
}));
