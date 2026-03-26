import { createContext, useContext } from "react";

type SyncGateContextValue = {
  categoriesStatus: "loading" | "ready" | "error";
  categoriesRevision: number;
  retryCategories: () => void;
};

const SyncGateContext = createContext<SyncGateContextValue | null>(null);

export function SyncGateProvider({
  value,
  children,
}: {
  value: SyncGateContextValue;
  children: React.ReactNode;
}) {
  return (
    <SyncGateContext.Provider value={value}>
      {children}
    </SyncGateContext.Provider>
  );
}

export function useSyncGate() {
  const context = useContext(SyncGateContext);
  if (!context) {
    throw new Error("useSyncGate must be used within SyncGateProvider");
  }
  return context;
}
