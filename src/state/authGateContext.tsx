import { createContext, useContext } from "react";

export type AuthEntryTarget = "entry" | "signIn" | "signUp";

type AuthGateContextValue = {
  allowAnonymous: boolean;
  authEntryTarget: AuthEntryTarget;
  continueAsGuest: () => void;
  openAuthEntry: () => void;
  openSignIn: () => void;
  openSignUp: () => void;
  resetAnonymous: () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({
  value,
  children,
}: {
  value: AuthGateContextValue;
  children: React.ReactNode;
}) {
  return (
    <AuthGateContext.Provider value={value}>
      {children}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const context = useContext(AuthGateContext);
  if (!context) {
    throw new Error("useAuthGate must be used within AuthGateProvider");
  }
  return context;
}
