import { useEffect, useRef, useState } from "react";
import { useAppInitStore } from "../state/appInitStore";
import { useAuthStore } from "../auth/authStore";
import { useSettingsStore } from "../settings/settingsStore";
import { useAuthGate } from "../state/authGateContext";
import { attachAnonymousDataToUser } from "../services/loginMergeService";
import { ensureDefaultCategories } from "../services/categorySeedService";
import {
  repairAmbiguousCategoryRefs,
  repairInvalidScopedDefaultCategoryIds,
  repairLocalCategoryDuplicates,
  repairMissingCategoryRefs,
} from "../services/categoryRepairService";
import {
  pullRemoteBudgets,
  pullRemoteCategories,
  pullRemoteExpenses,
  pullRemoteRecurringExpenses,
  pushLocalBudgets,
  pushLocalRecurringExpenses,
  pushDirtyCategories,
  pushDirtyExpenses,
} from "../sync/syncService";
import {
  subscribeToBudgetMutations,
  subscribeToCategoryMutations,
  subscribeToExpenseMutations,
  subscribeToRecurringExpenseMutations,
} from "../sync/syncEvents";
import { guestScope, userScope } from "../domain/dataScope";
import { materializeDueRecurringExpenses } from "../services/recurringExpenseService";

export function useAppRuntime() {
  const appInit = useAppInitStore();
  const auth = useAuthStore();
  const settings = useSettingsStore();
  const { allowAnonymous } = useAuthGate();

  const [categoriesStatus, setCategoriesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");
  const [categoriesRevision, setCategoriesRevision] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const mutationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    appInit.initialize();
    auth.initialize();
    settings.initialize();
  }, []);

  useEffect(() => {
    if (!appInit.ready || auth.initializing || !settings.ready) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      const deviceId = appInit.deviceId;
      if (!deviceId) return;

      setCategoriesStatus("loading");
      setSyncStatus("syncing");
      setSyncMessage(null);
      syncInFlightRef.current = true;

      try {
        if (auth.user?.id) {
          const scope = userScope(auth.user.id);
          await attachAnonymousDataToUser(auth.user.id);
          await pullRemoteCategories(auth.user.id);
          await repairInvalidScopedDefaultCategoryIds();
          await repairLocalCategoryDuplicates(scope, deviceId);
          await ensureDefaultCategories(scope, deviceId);
          await pullRemoteExpenses(auth.user.id);
          await pullRemoteBudgets(auth.user.id);
          await pullRemoteRecurringExpenses(auth.user.id);
          await repairMissingCategoryRefs(scope, deviceId);
          await repairAmbiguousCategoryRefs(scope, deviceId);
          await materializeDueRecurringExpenses(scope, deviceId);
          await pushDirtyCategories(auth.user.id);
          await pushDirtyExpenses(auth.user.id);
          await pushLocalBudgets(auth.user.id);
          await pushLocalRecurringExpenses(auth.user.id);
          if (!cancelled) {
            setLastSyncAt(new Date().toISOString());
          }
        } else if (allowAnonymous) {
          const scope = guestScope();
          await repairInvalidScopedDefaultCategoryIds();
          await repairLocalCategoryDuplicates(scope, deviceId);
          await ensureDefaultCategories(scope, deviceId);
          await repairMissingCategoryRefs(scope, deviceId);
          await repairAmbiguousCategoryRefs(scope, deviceId);
          await materializeDueRecurringExpenses(scope, deviceId);
        }

        if (!cancelled) {
          setCategoriesStatus("ready");
          setSyncStatus(auth.user ? "ready" : "idle");
          setCategoriesRevision((value) => value + 1);
        }
      } catch (error) {
        console.error("[APP] runtime sync failed", error);
        if (!cancelled) {
          setCategoriesStatus("error");
          setSyncStatus("error");
          setSyncMessage((error as Error).message ?? "errors.runtimeSyncFailed");
        }
      } finally {
        syncInFlightRef.current = false;
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    allowAnonymous,
    appInit.deviceId,
    appInit.ready,
    auth.initializing,
    auth.user?.id,
    retryNonce,
    settings.ready,
  ]);

  useEffect(() => {
    if (!auth.user?.id || categoriesStatus !== "ready") {
      return;
    }

    const flushMutations = async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncStatus("syncing");

      try {
        await pushDirtyCategories(auth.user!.id);
        await pushDirtyExpenses(auth.user!.id);
        await pushLocalBudgets(auth.user!.id);
        await pushLocalRecurringExpenses(auth.user!.id);
        setSyncStatus("ready");
        setLastSyncAt(new Date().toISOString());
        setCategoriesRevision((value) => value + 1);
      } catch (error) {
        console.error("[APP] mutation sync failed", error);
        setSyncStatus("error");
        setSyncMessage((error as Error).message ?? "errors.mutationSyncFailed");
      } finally {
        syncInFlightRef.current = false;
      }
    };

    const queue = () => {
      if (mutationTimerRef.current) {
        clearTimeout(mutationTimerRef.current);
      }

      mutationTimerRef.current = setTimeout(() => {
        mutationTimerRef.current = null;
        flushMutations();
      }, 350);
    };

    const unsubscribeExpenses = subscribeToExpenseMutations(queue);
    const unsubscribeCategories = subscribeToCategoryMutations(queue);
    const unsubscribeBudgets = subscribeToBudgetMutations(queue);
    const unsubscribeRecurring = subscribeToRecurringExpenseMutations(queue);

    return () => {
      if (mutationTimerRef.current) {
        clearTimeout(mutationTimerRef.current);
        mutationTimerRef.current = null;
      }
      unsubscribeExpenses();
      unsubscribeCategories();
      unsubscribeBudgets();
      unsubscribeRecurring();
    };
  }, [auth.user?.id, categoriesStatus]);

  useEffect(() => {
    if (!auth.user?.id || categoriesStatus !== "ready") {
      return;
    }

    const intervalId = setInterval(async () => {
      if (syncInFlightRef.current) return;

      try {
        setSyncStatus("syncing");
        await pullRemoteCategories(auth.user!.id);
        await pullRemoteExpenses(auth.user!.id);
        await pullRemoteBudgets(auth.user!.id);
        await pullRemoteRecurringExpenses(auth.user!.id);
        setSyncStatus("ready");
        setLastSyncAt(new Date().toISOString());
        setCategoriesRevision((value) => value + 1);
      } catch (error) {
        console.error("[APP] background pull failed", error);
        setSyncStatus("error");
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [auth.user?.id, categoriesStatus]);

  return {
    categoriesStatus,
    syncStatus,
    categoriesRevision,
    lastSyncAt,
    syncMessage,
    retrySync: () => setRetryNonce((value) => value + 1),
  };
}
