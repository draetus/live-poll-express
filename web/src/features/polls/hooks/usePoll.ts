import type { PollView } from "@shared/api";
import type { ServerMessage } from "@shared/ws";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useRealtime } from "../../../app/RealtimeProvider";
import { errorMessage } from "../../../lib/error-messages";
import { ApiError, isAbortError } from "../../../lib/http";
import { pollsApi } from "../api";
import { actionFromServer, initialPollState, pollReducer } from "../poll-reducer";

// Mensagens que citam outra enquete (ex.: restos da enquete anterior, que chegaram
// antes de o servidor processar o unsubscribe) são descartadas.
function isAboutPoll(message: ServerMessage, pollId: string): boolean {
  if (message.type === "poll:snapshot") return message.poll.id === pollId;
  if ("pollId" in message) return message.pollId === pollId;
  return true; // "error" não traz pollId: é sobre a assinatura atual
}

// Junta as duas fontes num reducer só:
// - REST: o carregamento inicial (e recargas);
// - WebSocket: tudo que muda depois (votos, encerramento, espectadores).
// Quem usa deve montar o componente com key={pollId}: trocar de enquete
// cria um componente novo, com estado novo (sem restos da enquete anterior).
export function usePoll(pollId: string) {
  const realtime = useRealtime();
  const [state, dispatch] = useReducer(pollReducer, initialPollState);
  // Incrementar este número faz o efeito rodar de novo, ou seja, recarrega a enquete.
  const [reloadCount, setReloadCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadCount existe só para disparar o efeito de novo
  useEffect(() => {
    const controller = new AbortController();

    pollsApi.get(pollId, controller.signal).then(
      (poll) => dispatch({ type: "loaded", poll }),
      (err: unknown) => {
        if (isAbortError(err)) return; // cancelamos nós mesmos (cleanup)
        if (err instanceof ApiError && err.code === "POLL_NOT_FOUND") {
          dispatch({ type: "notFound" });
        } else {
          dispatch({ type: "failed", message: errorMessage(err) });
        }
      },
    );

    return () => controller.abort();
  }, [pollId, reloadCount]);

  useEffect(() => {
    // Ordem: primeiro os ouvintes, depois a assinatura — nenhuma mensagem se perde.
    const stopMessages = realtime.onMessage((message) => {
      if (!isAboutPoll(message, pollId)) return;
      const action = actionFromServer(message);
      if (action) dispatch(action);
    });
    const stopState = realtime.onStateChange((connection) =>
      dispatch({ type: "connection", state: connection }),
    );
    dispatch({ type: "connection", state: realtime.getState() });
    realtime.subscribe(pollId);

    return () => {
      stopMessages();
      stopState();
      realtime.unsubscribe(pollId);
    };
  }, [realtime, pollId]);

  // useCallback: a MESMA função entre renderizações, então pode ir em dependências
  // de outros efeitos sem fazê-los rodar à toa.
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const applyVote = useCallback((poll: PollView) => dispatch({ type: "voted", poll }), []);

  return { state, reload, applyVote };
}
