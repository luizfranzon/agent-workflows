import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./shared/design-system/tokens.css";
import "./shared/design-system/components.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
