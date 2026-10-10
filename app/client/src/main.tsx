import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted open-source fonts (OFL-1.1), bundled with the app instead of loaded from Google.
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/inter/opsz-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
