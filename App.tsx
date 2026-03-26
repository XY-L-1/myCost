import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useAppInitStore } from "./src/state/appInitStore";
import { useAuthStore } from "./src/auth/authStore";
import { AuthGateProvider } from "./src/state/authGateContext";
import { SyncGateProvider } from "./src/state/syncGateContext";
import * as SecureStore from "expo-secure-store";
import { attachAnonymousDataToUser } from "./src/services/loginMergeService";
import { ensureDefaultCategories } from "./src/services/categorySeedService";
import {
  repairLocalCategoryDuplicates,
  repairMissingCategoryRefs,
} from "./src/services/categoryRepairService";
import {
  pullRemoteCategories,
  pullRemoteExpenses,
  pushDirtyCategories,
  pushDirtyExpenses,
} from "./src/sync/syncService";
import {
  subscribeToCategoryMutations,
  subscribeToExpenseMutations,
} from "./src/sync/syncEvents";

import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { RootNavigator, RootStackParamList } from "./src/navigation/RootNavigator";
import { AuthNavigator } from "./src/navigation/AuthNavigator";


export default function App() {
  const appInit = useAppInitStore();
  const auth = useAuthStore();
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [categoriesStatus, setCategoriesStatus] = useState<
    "loading" | "ready" | "error"
  >("ready");
  const [categoriesRevision, setCategoriesRevision] = useState(0);
  const [syncNonce, setSyncNonce] = useState(0);
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSyncNonceRef = useRef<number>(-1);
  const pendingNavResetRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncAttemptRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStartedAtRef = useRef<number | null>(null);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const mutationRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationAttemptRef = useRef(0);
  const mutationQueuedRef = useRef(false);
  const navigationRef = useRef(createNavigationContainerRef<RootStackParamList>())
    .current;

  const setCategoriesStatusWithLog = (
    nextStatus: "loading" | "ready" | "error",
    source: string
  ) => {
    setCategoriesStatus((prev) => {
      if (prev === nextStatus) {
        console.log(
          `[SYNC] categoriesStatus stays ${prev} (${source})`
        );
        return prev;
      }
      console.log(`[SYNC] categoriesStatus -> ${nextStatus} (${source})`);
      return nextStatus;
    });
  };

  useEffect(() => {
    appInit.initialize();
    auth.initialize();
  }, []);

  useEffect(() => {
    const userId = auth.user?.id ?? null;

    if (userId) {
      // Reset anonymous mode when a real session is active.
      setAllowAnonymous(false);
      console.log("[SYNC] auth.user active", { userId });
    } else {
      setCategoriesStatusWithLog("ready", "auth.user null");
    }
  }, [auth.user?.id]);

  useEffect(() => {
    const MAX_SYNC_ATTEMPTS = 3;
    const BASE_RETRY_MS = 1500;
    let cancelled = false;

    const clearRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
        console.log("[SYNC] cleared retry timer");
      }
    };

    console.log("[SYNC] login-sync effect start", {
      appReady: appInit.ready,
      authInit: auth.initializing,
      userId: auth.user?.id ?? null,
      categoriesStatus,
      inFlight: syncInFlightRef.current,
      retryTimer: !!retryTimeoutRef.current,
      lastSynced: lastSyncedUserIdRef.current,
      syncAttempt: syncAttemptRef.current,
      syncNonce,
    });

    if (auth.initializing || !appInit.ready) {
      console.log(
        "[SYNC] return because auth.initializing or appInit not ready",
        {
          authInit: auth.initializing,
          appReady: appInit.ready,
        }
      );
      return;
    }

    if (!auth.user) {
      // Reset sync flags when the session ends.
      clearRetry();
      lastSyncedUserIdRef.current = null;
      lastSyncNonceRef.current = -1;
      syncInFlightRef.current = false;
      syncAttemptRef.current = 0;
      console.log("[SYNC] return because no auth.user");
      return;
    }

    const userId = auth.user.id;

    const startSync = () => {
      console.log("[SYNC] startSync called", {
        appReady: appInit.ready,
        authInit: auth.initializing,
        userId: auth.user?.id,
        categoriesStatus,
        inFlight: syncInFlightRef.current,
        lastSynced: lastSyncedUserIdRef.current,
        retryTimer: !!retryTimeoutRef.current,
        syncAttempt: syncAttemptRef.current,
        syncNonce,
        lastSyncNonce: lastSyncNonceRef.current,
      });

      const forceSync = syncNonce !== lastSyncNonceRef.current;

      if (forceSync) {
        // Manual retry should bypass stale backoff timers.
        clearRetry();
      }

      if (cancelled) {
        console.log("[SYNC] return because cancelled");
        return;
      }

      if (syncInFlightRef.current) {
        console.log("[SYNC] return because syncInFlightRef true");
        return;
      }

      if (!forceSync && lastSyncedUserIdRef.current === userId) {
        // Ensure we only sync once per login session.
        console.log("[SYNC] return because already synced this user");
        return;
      }

      if (!forceSync && retryTimeoutRef.current) {
        // Respect backoff timer.
        console.log("[SYNC] return because retry timer active");
        return;
      }

      setCategoriesStatusWithLog("loading", "startSync");
      syncInFlightRef.current = true;
      syncStartedAtRef.current = Date.now();

      (async () => {
        try {
          console.log("[SYNC] enter login sync try");
          // Attach any anonymous local data before pushing it to Supabase.
          await attachAnonymousDataToUser(userId);
          console.log("[SYNC] attachAnonymousDataToUser done");
          // Pull categories first so expenses resolve category_id correctly.
          await pullRemoteCategories(userId);
          console.log("[SYNC] pullRemoteCategories done");
          const deviceId = await SecureStore.getItemAsync("deviceId");
          if (!deviceId) {
            throw new Error("Missing deviceId during login sync");
          }
          // Repair any local duplicate categories before seeding defaults.
          await repairLocalCategoryDuplicates(userId, deviceId);
          console.log("[SYNC] repairLocalCategoryDuplicates done");
          // Seed deterministic defaults only after remote categories exist.
          await ensureDefaultCategories(userId, deviceId);
          console.log("[SYNC] ensureDefaultCategories done");
          // Pull remote expenses before pushing to reconcile conflicts locally.
          await pullRemoteExpenses(userId);
          console.log("[SYNC] pullRemoteExpenses done");
          // Ensure every expense points to an existing local category.
          await repairMissingCategoryRefs(userId, deviceId);
          console.log("[SYNC] repairMissingCategoryRefs done");
          if (!cancelled) {
            // Gate expense rendering until categories + expenses are present.
            setCategoriesStatusWithLog("ready", "login sync success");
            pendingNavResetRef.current = true;
          }
          // Push dirty categories before expenses to preserve references.
          await pushDirtyCategories(userId);
          setCategoriesRevision((value) => value + 1);
          console.log("[SYNC] pushDirtyCategories done");
          console.log("[SYNC] categoriesRevision bumped (login sync)");
          // Trigger a one-time push for dirty expenses after auth completes.
          await pushDirtyExpenses(userId);
          console.log("[SYNC] pushDirtyExpenses done");
          lastSyncedUserIdRef.current = userId;
          lastSyncNonceRef.current = syncNonce;
          console.log("[SYNC] lastSyncedUserIdRef set", userId);
          syncAttemptRef.current = 0;
          clearRetry();
        } catch (error) {
          console.error("[SYNC] Login sync failed", error);
          let recoveredOffline = false;

          if (!cancelled) {
            try {
              const deviceId = await SecureStore.getItemAsync("deviceId");
              if (deviceId) {
                await repairLocalCategoryDuplicates(userId, deviceId);
                await ensureDefaultCategories(userId, deviceId);
                await repairMissingCategoryRefs(userId, deviceId);
                recoveredOffline = true;
                setCategoriesStatusWithLog(
                  "ready",
                  "login sync fallback offline"
                );
              }
            } catch (fallbackError) {
              console.error("[SYNC] Offline fallback failed", fallbackError);
              setCategoriesStatusWithLog("error", "login sync failed");
            }
          }

          if (!recoveredOffline) {
            syncAttemptRef.current += 1;

            if (syncAttemptRef.current < MAX_SYNC_ATTEMPTS) {
              const delay =
                BASE_RETRY_MS * Math.pow(2, syncAttemptRef.current - 1);
              // Backoff retry to avoid hammering the network.
              retryTimeoutRef.current = setTimeout(() => {
                retryTimeoutRef.current = null;
                startSync();
              }, delay);
            }
          } else {
            // Avoid retry loops while offline; manual retry can restart sync.
            syncAttemptRef.current = 0;
          }
        } finally {
          syncInFlightRef.current = false;
          syncStartedAtRef.current = null;
          console.log("[SYNC] login sync finished");
        }
      })();
    };

    startSync();

    return () => {
      cancelled = true;
      clearRetry();
    };
  }, [auth.initializing, auth.user, appInit.ready, syncNonce]);

  useEffect(() => {
    if (!auth.user || categoriesStatus !== "ready") return;
    if (!pendingNavResetRef.current) return;
    if (!navigationRef.isReady()) {
      console.log("[NAV] reset skipped: navigation not ready yet");
      return;
    }

    console.log("[NAV] resetRoot to MainTabs after sync");
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
    pendingNavResetRef.current = false;
  }, [auth.user?.id, categoriesStatus, navigationRef]);

  useEffect(() => {
    if (auth.initializing || !auth.user || categoriesStatus !== "ready") {
      return;
    }

    const MAX_MUTATION_ATTEMPTS = 3;
    const MUTATION_DEBOUNCE_MS = 400;
    const MUTATION_RETRY_BASE_MS = 1500;

    const clearMutationTimers = () => {
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
        mutationDebounceRef.current = null;
      }
      if (mutationRetryRef.current) {
        clearTimeout(mutationRetryRef.current);
        mutationRetryRef.current = null;
      }
    };

    const runMutationSync = async () => {
      const userId = auth.user?.id;
      if (!userId) {
        return;
      }

      if (!mutationQueuedRef.current) {
        return;
      }

      if (syncInFlightRef.current) {
        if (!mutationRetryRef.current) {
          mutationRetryRef.current = setTimeout(() => {
            mutationRetryRef.current = null;
            runMutationSync();
          }, MUTATION_RETRY_BASE_MS);
        }
        return;
      }

      mutationQueuedRef.current = false;
      syncInFlightRef.current = true;

      try {
        // Event-driven push after local writes (idempotent).
        await pushDirtyCategories(userId);
        setCategoriesRevision((value) => value + 1);
        console.log("[SYNC] categoriesRevision bumped (mutation sync)");
        await pushDirtyExpenses(userId);
        mutationAttemptRef.current = 0;
      } catch (error) {
        console.error("[SYNC] Mutation sync failed", error);
        mutationAttemptRef.current += 1;

        if (mutationAttemptRef.current < MAX_MUTATION_ATTEMPTS) {
          const delay =
            MUTATION_RETRY_BASE_MS *
            Math.pow(2, mutationAttemptRef.current - 1);
          mutationRetryRef.current = setTimeout(() => {
            mutationRetryRef.current = null;
            runMutationSync();
          }, delay);
        }
      } finally {
        syncInFlightRef.current = false;
      }
    };

    const onExpenseMutation = () => {
      mutationQueuedRef.current = true;

      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
      }

      mutationDebounceRef.current = setTimeout(() => {
        mutationDebounceRef.current = null;
        runMutationSync();
      }, MUTATION_DEBOUNCE_MS);
    };

    const unsubscribeExpenses = subscribeToExpenseMutations(onExpenseMutation);
    const unsubscribeCategories = subscribeToCategoryMutations(onExpenseMutation);

    return () => {
      clearMutationTimers();
      mutationQueuedRef.current = false;
      mutationAttemptRef.current = 0;
      unsubscribeExpenses();
      unsubscribeCategories();
    };
  }, [auth.initializing, auth.user, categoriesStatus]);

  useEffect(() => {
    if (auth.initializing || !auth.user || categoriesStatus !== "ready") {
      return;
    }

    const CATEGORY_PULL_INTERVAL_MS = 5 * 60 * 1000;
    let cancelled = false;

    const pullCategories = async () => {
      if (cancelled) return;
      if (syncInFlightRef.current) return;
      try {
        // Lightweight background pull to keep categories consistent across devices.
        await pullRemoteCategories(auth.user!.id);
      } catch (error) {
        console.error("[SYNC] Category background pull failed", error);
      }
    };

    const intervalId = setInterval(pullCategories, CATEGORY_PULL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [auth.initializing, auth.user, categoriesStatus]);

  if (appInit.initializing || auth.initializing) {
    return <Text>Initializing app...</Text>;
  }

  if (!appInit.ready) {
    return null;
  }

  const navKey = auth.user
    ? `user:${auth.user.id}`
    : allowAnonymous
      ? "guest"
      : "auth";

  console.log("[UI] App render", {
    navKey,
    allowAnonymous,
    userId: auth.user?.id ?? null,
    categoriesStatus,
  });

  return (
    <AuthGateProvider
      value={{
        allowAnonymous,
        continueAsGuest: () => setAllowAnonymous(true),
        resetAnonymous: () => setAllowAnonymous(false),
      }}
    >
      <SyncGateProvider
        value={{
          categoriesStatus,
          categoriesRevision,
          retryCategories: () => {
            if (!auth.user || auth.initializing) return;
            setCategoriesStatusWithLog("loading", "retryCategories");
            lastSyncedUserIdRef.current = null;
            lastSyncNonceRef.current = -1;
            syncAttemptRef.current = 0;
            setSyncNonce((value) => value + 1);
            console.log("[SYNC] retryCategories requested");
          },
        }}
      >
        <NavigationContainer
          key={navKey}
          ref={navigationRef}
          onReady={() =>
            console.log("[NAV] NavigationContainer ready", { navKey })
          }
        >
          {auth.user || allowAnonymous ? <RootNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </SyncGateProvider>
    </AuthGateProvider>
  );
}
