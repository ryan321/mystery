/**
 * Client-side view of the API session. The truth is the httpOnly
 * session cookie on the API origin (magic link or Google); this store
 * is a localStorage mirror so the nav can branch synchronously.
 * refreshSession() reconciles the mirror against GET /v1/me.
 */
import { apiSignOut, fetchMe } from "./api";

export type AuthSession = {
  email: string;
  displayName: string;
};

const STORAGE_KEY = "mystery.auth.session";

const LISTENERS = new Set<() => void>();

function notify() {
  for (const fn of LISTENERS) fn();
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.email || typeof parsed.email !== "string") return null;
    return {
      email: parsed.email,
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName.trim()
          : parsed.email.split("@")[0] || "Investigator",
    };
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return getSession() != null;
}

export function signIn(email: string, displayName?: string): AuthSession {
  const session: AuthSession = {
    email: email.trim().toLowerCase(),
    displayName:
      displayName?.trim() ||
      email.trim().split("@")[0] ||
      "Investigator",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  notify();
  return session;
}

export function signOut(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  // Destroy the real API session too (fire and forget).
  void apiSignOut();
  notify();
}

/**
 * Reconcile the localStorage mirror with the API session. Signed in →
 * refresh the mirror; explicitly anonymous → clear a stale mirror.
 * Network errors leave the mirror untouched.
 */
export async function refreshSession(): Promise<AuthSession | null> {
  try {
    const me = await fetchMe();
    if (me.user) {
      return signIn(me.user.email, me.user.displayName);
    }
    if (me.anonymous && getSession()) {
      localStorage.removeItem(STORAGE_KEY);
      notify();
    }
    return null;
  } catch {
    return getSession();
  }
}

/** Subscribe to session changes (same tab + storage events from other tabs). */
export function subscribeAuth(onChange: () => void): () => void {
  LISTENERS.add(onChange);
  function onStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    LISTENERS.delete(onChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
