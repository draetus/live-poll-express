import type { HealthResponse } from "@shared/api";
import { useEffect, useState } from "react";
import { config } from "../lib/config";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Checking API…",
  online: "API online",
  offline: "API offline",
};

const DOT_COLORS: Record<Status, string> = {
  checking: "bg-amber-400",
  online: "bg-emerald-500",
  offline: "bg-rose-500",
};

// Fase 1: prova de ponta a ponta de que o front alcança a API (URL, CORS e contrato do shared/).
// Na fase 7, isto evolui para o useServerStatus, com novas tentativas durante o cold start.
export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function check() {
      try {
        const res = await fetch(`${config.apiUrl}/health`, {
          // Cancela se o componente sair da tela OU se passar de 5 s
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        const body = (await res.json()) as HealthResponse;
        setStatus(res.ok && body.status === "ok" ? "online" : "offline");
      } catch {
        // Se fomos nós que cancelamos (cleanup), não há mais tela para atualizar
        if (!controller.signal.aborted) setStatus("offline");
      }
    }

    void check();
    return () => controller.abort(); // cleanup: roda ao desmontar (e no "ensaio" do StrictMode)
  }, []); // [] = roda uma vez, quando o componente aparece na tela

  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
    >
      <span className={`size-2 rounded-full ${DOT_COLORS[status]}`} aria-hidden="true" />
      {LABELS[status]}
    </p>
  );
}
