import { render } from "solid-js/web";
import { captureOAuthTokensFromUrl } from "./authToken";
import { AppAuthGate } from "./AppAuthGate";
import { SessionProvider } from "./session/SessionContext";
import "./index.css";

captureOAuthTokensFromUrl();

render(
  () => (
    <SessionProvider>
      <AppAuthGate />
    </SessionProvider>
  ),
  document.getElementById("root") as HTMLElement
);
