import { keyValueStorage } from "../services/keyValueStorage";

const DEFAULT_AUTH_STORAGE_KEY = "sb-auth-token";

function getSupabaseProjectRef() {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
    return url.hostname.split(".")[0] || DEFAULT_AUTH_STORAGE_KEY;
  } catch {
    return DEFAULT_AUTH_STORAGE_KEY;
  }
}

export const SUPABASE_AUTH_STORAGE_KEY = `sb-${getSupabaseProjectRef()}-auth-token`;
export const SUPABASE_AUTH_USER_STORAGE_KEY = `${SUPABASE_AUTH_STORAGE_KEY}-user`;

export const supabaseSessionStorage = {
  isServer: false,
  getItem: keyValueStorage.getItem,
  setItem: keyValueStorage.setItem,
  removeItem: keyValueStorage.removeItem,
};

export const supabaseUserStorage = {
  isServer: false,
  getItem: keyValueStorage.getItem,
  setItem: async (key: string, value: string) => {
    const sanitized = sanitizeUserEnvelope(value);
    await keyValueStorage.setItem(key, sanitized);
  },
  removeItem: keyValueStorage.removeItem,
};

export async function prepareSupabaseAuthStorage() {
  const rawSession = await keyValueStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
  if (!rawSession) {
    return;
  }

  try {
    const parsed = JSON.parse(rawSession) as { user?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || !("user" in parsed) || !parsed.user) {
      return;
    }

    await supabaseUserStorage.setItem(
      SUPABASE_AUTH_USER_STORAGE_KEY,
      JSON.stringify({ user: parsed.user })
    );

    const sessionWithoutUser = { ...parsed };
    delete sessionWithoutUser.user;

    await supabaseSessionStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      JSON.stringify(sessionWithoutUser)
    );
  } catch {
    // Leave the legacy value untouched if it cannot be parsed.
  }
}

function sanitizeUserEnvelope(value: string) {
  try {
    const parsed = JSON.parse(value) as { user?: Record<string, unknown> } | null;
    if (!parsed?.user || typeof parsed.user !== "object") {
      return value;
    }

    return JSON.stringify({
      user: sanitizeUser(parsed.user),
    });
  } catch {
    return value;
  }
}

function sanitizeUser(user: Record<string, unknown>) {
  return {
    id: asString(user.id),
    aud: asString(user.aud),
    role: asString(user.role),
    email: asString(user.email),
    phone: asString(user.phone),
    created_at: asString(user.created_at),
    confirmed_at: asString(user.confirmed_at),
    email_confirmed_at: asString(user.email_confirmed_at),
    phone_confirmed_at: asString(user.phone_confirmed_at),
    last_sign_in_at: asString(user.last_sign_in_at),
    app_metadata: sanitizeMetadata(user.app_metadata),
    user_metadata: sanitizeMetadata(user.user_metadata),
  };
}

function sanitizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
  return Object.fromEntries(
    entries
      .map(([key, entry]) => [key, sanitizeMetadataValue(entry)] as const)
      .filter(([, entry]) => entry !== undefined)
  );
}

function sanitizeMetadataValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .filter(
        (entry) =>
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean"
      );
  }

  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}
