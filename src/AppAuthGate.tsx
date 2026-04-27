import { Show } from "solid-js";
import { App } from "./App";
import { AuthLandingPage } from "./components/auth/AuthLandingPage";
import { useSession } from "./session/SessionContext";

/**
 * Top-level auth gate that selects between sign-in and app shell.
 *
 * State modification contract:
 * - Source of truth: authentication state from `SessionContext`.
 * - This component does not mutate auth state; it only branches render output.
 * - Guard behavior: unauthenticated sessions are always redirected to
 *   `AuthLandingPage` rendering path.
 */
export function AppAuthGate() {
  const session = useSession();

  return (
    <Show when={session.isAuthenticated()} fallback={<AuthLandingPage />}>
      <App />
    </Show>
  );
}
