import type { HealthResponse } from "@shared/api";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { request } from "../lib/http";

/**
 * - checking: primeira verificação em andamento (por pouco tempo: nada aparece na tela).
 * - waking: o servidor não respondeu ainda; provavelmente acordando (cold start do Render).
 * - online: o /health respondeu. Daqui em diante, cada requisição cuida dos próprios erros.
 * - offline: desistimos depois de ~90 s; o usuário pode tentar de novo.
 */
export type ServerStatus = "checking" | "waking" | "online" | "offline";

export const HEALTH_CHECK = {
  timeoutMs: 5_000, // cada tentativa espera no máximo 5 s
  retryEveryMs: 3_000, // pausa entre tentativas
  giveUpAfterMs: 90_000, // o Render grátis leva de 30 a 60 s para acordar; 90 s dá folga
  slowAfterMs: 1_500, // a 1ª tentativa demorou isso? Mostra o aviso sem esperar ela falhar
} as const;

interface ServerStatusValue {
  status: ServerStatus;
  retry(): void;
}

const ServerStatusContext = createContext<ServerStatusValue | null>(null);

interface ServerStatusProviderProps {
  children: ReactNode;
  /** Os testes fixam o status e pulam o ping. */
  status?: ServerStatus;
}

// Um ping só para o app inteiro: a Home, a página da enquete e o WebSocket
// consultam o mesmo status, em vez de cada um fazer suas próprias tentativas.
export function ServerStatusProvider({ children, status: fixed }: ServerStatusProviderProps) {
  const [status, setStatus] = useState<ServerStatus>(fixed ?? "checking");
  // Incrementar este número reinicia o ciclo de tentativas (botão "Try again").
  const [round, setRound] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: round existe só para reiniciar o efeito
  useEffect(() => {
    if (fixed) return;
    const controller = new AbortController();
    const startedAt = Date.now();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Se a 1ª resposta demorar, o aviso aparece já (o pedido continua em andamento).
    const slowTimer = setTimeout(
      () => setStatus((current) => (current === "checking" ? "waking" : current)),
      HEALTH_CHECK.slowAfterMs,
    );

    async function check() {
      try {
        await request<HealthResponse>("/health", {
          signal: controller.signal,
          timeoutMs: HEALTH_CHECK.timeoutMs,
        });
        clearTimeout(slowTimer);
        setStatus("online");
        return;
      } catch {
        if (controller.signal.aborted) return; // cleanup: a tela não existe mais
      }
      clearTimeout(slowTimer);
      if (Date.now() - startedAt >= HEALTH_CHECK.giveUpAfterMs) {
        setStatus("offline");
        return;
      }
      setStatus("waking");
      retryTimer = setTimeout(check, HEALTH_CHECK.retryEveryMs);
    }

    void check();
    return () => {
      controller.abort();
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
    };
  }, [fixed, round]);

  const retry = useCallback(() => {
    setStatus("checking");
    setRound((n) => n + 1);
  }, []);

  // useMemo: o objeto do contexto só muda quando o status muda. Um objeto novo a cada
  // render faria TODOS os componentes que usam o contexto renderizarem de novo à toa.
  const value = useMemo(() => ({ status: fixed ?? status, retry }), [fixed, status, retry]);

  return <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>;
}

export function useServerStatus(): ServerStatusValue {
  const value = useContext(ServerStatusContext);
  if (!value) throw new Error("useServerStatus must be used inside <ServerStatusProvider>");
  return value;
}
