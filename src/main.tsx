import { render } from "solid-js/web";
import App from "./App";
import "./index.css";

// Single app mount point for the dashboard editor.
render(() => <App />, document.getElementById("root") as HTMLElement);
