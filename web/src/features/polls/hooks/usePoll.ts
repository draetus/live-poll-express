import type { PollView } from "@shared/api";
import { useCallback, useEffect, useReducer, useState } from "react";
import { errorMessage } from "../../../lib/error-messages";
import { ApiError, isAbortError } from "../../../lib/http";
import { pollsApi } from "../api";
import { initialPollState, pollReducer } from "../poll-reducer";

// Carrega uma enquete pela API REST e guarda o estado num reducer.
// Quem usa deve montar o componente com key={pollId}: trocar de enquete
// cria um componente novo, com estado novo (sem restos da enquete anterior).
export function usePoll(pollId: string) {
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

  // useCallback: a MESMA função entre renderizações, então pode ir em dependências
  // de outros efeitos sem fazê-los rodar à toa.
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const setPoll = useCallback((poll: PollView) => dispatch({ type: "loaded", poll }), []);

  return { state, reload, setPoll };
}
