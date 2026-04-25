import { type ParentProps, createContext, createSignal, onMount, useContext } from "solid-js";
import { clearAuthTokens, getAccessToken } from "../authToken";
import { clearPersistedDashboards } from "../dashboardPersistence";

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

export function SessionProvider(props: ParentProps) {
  const [authenticated, setAuthenticated] = createSignal(
    typeof window !== "undefined" && !!getAccessToken()
  );

  const syncFromStorage = () => {
    setAuthenticated(!!getAccessToken());
  };

  const logIn = () => {
    window.location.assign("/api/auth/login");
  };

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
