import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { config } from "../lib/config";
import { RealtimeClient } from "../lib/realtime-client";
import { useServerStatus } from "./ServerStatusProvider";

// Context: um jeito de entregar um valor a QUALQUER componente abaixo na árvore,
// sem passar por props de pai para filho em cada nível ("prop drilling").
const RealtimeContext = createContext<RealtimeClient | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
  /** Os testes injetam um cliente com WebSocket falso. */
  client?: RealtimeClient;
}

export function RealtimeProvider({ children, client: injected }: RealtimeProviderProps) {
  // useState com função: o cliente é criado UMA vez por montagem, não a cada render.
  const [client] = useState(() => injected ?? new RealtimeClient({ url: config.wsUrl }));
  const online = useServerStatus().status === "online";

  useEffect(() => {
    // Cold start: enquanto o servidor acorda, tentar o WebSocket só queimaria tentativas
    // do backoff (que cresceria até 15 s). As páginas já podem assinar enquetes:
    // o cliente guarda a intenção e conecta assim que start() for chamado.
    if (!online) return;
    client.start();
    // No StrictMode (dev), este cleanup roda e o efeito roda de novo:
    // por isso stop() precisa ser reversível com start().
    return () => client.stop();
  }, [client, online]);

  return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeClient {
  const client = useContext(RealtimeContext);
  if (!client) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return client;
}
