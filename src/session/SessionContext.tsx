import { type ParentProps, createContext, createSignal, onMount, useContext } from "solid-js";
import { clearAuthTokens, getAccessToken } from "../authToken";
import { clearPersistedDashboards } from "../dashboardPersistence";

/**
 * Session context for auth state and auth-related side-effect commands.
 *
 * State modification contract:
 * - Source of truth: in-memory `authenticated` signal synchronized from token storage.
 * - Mutation paths:
 *   - `syncFromStorage` reads localStorage-backed token state.
 *   - `logOut` clears local auth/dashboard storage and marks session unauthenticated.
 *   - `logIn` delegates to backend auth entry via full-page redirect.
 * - Guard behavior: `useSession` throws outside provider boundaries.
 */

export type SessionValue = {
  /** True when a non-empty access token is in storage. */
  isAuthenticated: () => boolean;
  /** Resync with localStorage (e.g. after OAuth hash capture on same load). */
  syncFromStorage: () => void;
  /** Full-page redirect to the backend sign-in entry. */
  logIn: () => void;
  /** Clear local tokens, notify backend logout, and mark session as signed out. */
  logOut: () => void;
};

const SessionContext = createContext<SessionValue | undefined>(undefined);

/**
 * Provides session state and commands to descendant components.
 */
export function SessionProvider(props: ParentProps) {
  const [authenticated, setAuthenticated] = createSignal(
    typeof window !== "undefined" && !!getAccessToken()
  );

  /**
   * Synchronizes in-memory auth state from token persistence.
   */
  const syncFromStorage = () => {
    setAuthenticated(!!getAccessToken());
  };

  /**
   * Starts login by navigating to backend auth entrypoint.
   */
  const logIn = () => {
    window.location.assign("/api/auth/login");
  };

  /**
   * Clears local auth state and requests backend logout best-effort.
   */
  const logOut = () => {
    clearAuthTokens();
    clearPersistedDashboards();
    setAuthenticated(false);
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  onMount(() => {
    // OAuth tokens may be written before React/Solid first paint; stay aligned with storage.
    syncFromStorage();
  });

  const value: SessionValue = {
    isAuthenticated: () => authenticated(),
    syncFromStorage,
    logIn,
    logOut
  };

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (v === undefined) {
    throw new Error("useSession() must be used under <SessionProvider>");
  }
  return v;
}
