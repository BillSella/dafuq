import { render } from "solid-js/web";
import { captureOAuthTokensFromUrl } from "./authToken";
import App from "./App";
import "./index.css";

captureOAuthTokensFromUrl();

// Single app mount point for the dashboard editor.
render(() => <App />, document.getElementById("root") as HTMLElement);
