import { useMemo } from "react";
import { useAuthStore } from "../auth/authStore";
import { useAuthGate } from "../state/authGateContext";
import { guestScope, userScope } from "../domain/dataScope";

export function useCurrentScope() {
  const auth = useAuthStore();
  const { allowAnonymous } = useAuthGate();

  return useMemo(() => {
    if (auth.user?.id) {
      return userScope(auth.user.id);
    }

    if (allowAnonymous) {
      return guestScope();
    }

    return null;
  }, [allowAnonymous, auth.user?.id]);
}
