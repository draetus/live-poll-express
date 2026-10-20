import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in index.html");

// StrictMode (só em dev) roda efeitos duas vezes de propósito,
// para revelar efeitos sem limpeza (cleanup) adequada.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
