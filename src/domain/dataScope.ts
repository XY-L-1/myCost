export const GUEST_OWNER_KEY = "guest";

export type DataScope = {
  ownerKey: string;
  userId: string | null;
  mode: "guest" | "user";
};

export function guestScope(): DataScope {
  return {
    ownerKey: GUEST_OWNER_KEY,
    userId: null,
    mode: "guest",
  };
}

export function userScope(userId: string): DataScope {
  return {
    ownerKey: userId,
    userId,
    mode: "user",
  };
}

export function buildScopeFilter(
  scope: DataScope,
  column = "ownerKey"
): { clause: string; params: string[] } {
  return {
    clause: `${column} = ?`,
    params: [scope.ownerKey],
  };
}

export function getOwnerKey(userId: string | null) {
  return userId ?? GUEST_OWNER_KEY;
}
