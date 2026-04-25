import { Show } from "solid-js";
import App from "./App";
import { AuthLandingPage } from "./components/auth/AuthLandingPage";
import { useSession } from "./session/SessionContext";

/** Always show {@link AuthLandingPage} until tokens exist in session storage. */
export function AppAuthGate() {
  const session = useSession();

  return (
    <Show when={session.isAuthenticated()} fallback={<AuthLandingPage />}>
      <App />
    </Show>
  );
}
