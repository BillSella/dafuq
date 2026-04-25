import { createSignal } from "solid-js";
import { setAccessToken, setRefreshToken } from "../../authToken";
import { useSession } from "../../session/SessionContext";
import { DafuqLogo } from "../DafuqLogo";

/**
 * Full-screen sign-in gate for production builds. In `npm run dev`, the app mounts
 * without showing this screen (see AppAuthGate).
 *
 * State modification contract:
 * - Source of truth: local `username`, `password`, `pending`, and `error` signals.
 * - Mutation paths:
 *   - `onSubmit` updates pending/error and may persist tokens through auth helpers.
 *   - Successful sign-in triggers `session.syncFromStorage` to update app auth state.
 * - Guard behavior:
 *   - duplicate submits while pending are ignored
 *   - failed or malformed auth responses surface user-facing error state
 */
export function AuthLandingPage() {
  const session = useSession();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  /**
   * Submits credentials to password auth endpoint and hydrates session on success.
   */
  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (pending()) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: username().trim(),
          password: password()
        })
      });
      if (!response.ok) {
        setError("Sign-in failed. Check credentials and try again.");
        return;
      }
      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!body.access_token || !body.refresh_token) {
        setError("Sign-in response is missing tokens.");
        return;
      }
      setAccessToken(body.access_token);
      setRefreshToken(body.refresh_token);
      session.syncFromStorage();
    } catch {
      setError("Unable to reach auth service. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div class="auth-landing">
      <div class="auth-landing-card">
        <div class="auth-landing-logo">
          <DafuqLogo />
        </div>
        <h1 class="auth-landing-title">Sign in</h1>
        <p class="auth-landing-lead">
          Enter your credentials to open the dashboard.
        </p>
        <form class="auth-landing-form" onSubmit={onSubmit}>
          <label class="auth-landing-label" for="auth-username">
            Username
          </label>
          <input
            id="auth-username"
            class="auth-landing-input"
            type="text"
            autocomplete="username"
            value={username()}
            onInput={(event) => setUsername(event.currentTarget.value)}
            disabled={pending()}
          />
          <label class="auth-landing-label" for="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            class="auth-landing-input"
            type="password"
            autocomplete="current-password"
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
            disabled={pending()}
          />
          {error() && <p class="auth-landing-error">{error()}</p>}
          <button type="submit" class="auth-landing-cta" disabled={pending()}>
            {pending() ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
