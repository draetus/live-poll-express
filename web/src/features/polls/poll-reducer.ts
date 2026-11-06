import type { PollView } from "@shared/api";
import type { ServerMessage } from "@shared/ws";
import type { ConnectionState } from "../../lib/realtime-client";

/** Por que a enquete deixou de existir no servidor enquanto estava na tela. */
export type PollEnding = "removed" | "server-restarted";

// Estado da página de uma enquete. Cada "status" carrega só os dados que fazem
// sentido nele: não existe "carregando E com erro E com enquete" ao mesmo tempo.
export type PollState =
  | { status: "loading"; connection: ConnectionState }
  | {
      status: "ready";
      poll: PollView;
      viewers: number | null;
      ended: PollEnding | null;
      connection: ConnectionState;
    }
  | { status: "not-found"; connection: ConnectionState }
  | { status: "error"; message: string; connection: ConnectionState };

export type PollAction =
  // REST
  | { type: "loaded"; poll: PollView } // GET da enquete: verdade completa
  | { type: "voted"; poll: PollView } // resposta do POST de voto
  | { type: "notFound" }
  | { type: "failed"; message: string }
  // WebSocket
  | { type: "snapshot"; poll: PollView }
  | { type: "updated"; pollId: string; totals: Record<string, number>; totalVotes: number }
  | { type: "closed"; pollId: string }
  | { type: "removed"; pollId: string }
  | { type: "expired" } // o servidor não conhece mais a enquete (reiniciou)
  | { type: "viewers"; pollId: string; count: number }
  | { type: "connection"; state: ConnectionState };

export const initialPollState: PollState = { status: "loading", connection: "idle" };

type ReadyState = Extract<PollState, { status: "ready" }>;

function ready(state: PollState, poll: PollView): ReadyState {
  return {
    status: "ready",
    poll,
    viewers: state.status === "ready" ? state.viewers : null,
    ended: null,
    connection: state.connection,
  };
}

// Votos só aumentam e uma enquete encerrada nunca reabre. Então, entre duas versões
// da MESMA enquete, a com mais votos é a mais nova. Isso protege contra respostas
// que chegam fora de ordem (ex.: a resposta do meu voto chega DEPOIS de um
// poll:updated que já inclui o voto de outra pessoa).
function newest(current: PollView, incoming: PollView): PollView {
  const base = incoming.totalVotes >= current.totalVotes ? incoming : current;
  return { ...base, closed: current.closed || incoming.closed };
}

// Reducer: (estado atual, ação) → próximo estado. Função PURA: não chama API,
// não lê storage, não muda nada fora dela. Por isso é trivial de testar.
export function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    // Snapshot e GET são a verdade completa do servidor naquele momento: substituem tudo.
    // (Depois de um restart, a enquete do seed volta com 0 votos — e isso é o certo.)
    case "loaded":
    case "snapshot":
      return ready(state, action.poll);

    case "voted":
      if (state.status !== "ready" || state.poll.id !== action.poll.id) return state;
      return { ...state, poll: newest(state.poll, action.poll) };

    case "updated": {
      if (state.status !== "ready" || state.poll.id !== action.pollId) return state;
      if (action.totalVotes < state.poll.totalVotes) return state; // mensagem velha
      const options = state.poll.options.map((option) => ({
        ...option,
        votes: action.totals[option.id] ?? option.votes,
      }));
      return { ...state, poll: { ...state.poll, options, totalVotes: action.totalVotes } };
    }

    case "closed":
      if (state.status !== "ready" || state.poll.id !== action.pollId) return state;
      return { ...state, poll: { ...state.poll, closed: true } };

    case "removed":
      if (state.status !== "ready" || state.poll.id !== action.pollId) return state;
      return { ...state, ended: "removed" };

    case "expired":
      // Ainda carregando: o GET vai responder 404 de qualquer forma.
      if (state.status !== "ready") return state;
      return { ...state, ended: "server-restarted" };

    case "viewers":
      if (state.status !== "ready" || state.poll.id !== action.pollId) return state;
      return { ...state, viewers: action.count };

    case "connection":
      return { ...state, connection: action.state };

    case "notFound":
      return { status: "not-found", connection: state.connection };

    case "failed":
      // Se já temos a enquete na tela, uma falha ao recarregar não deve apagá-la.
      if (state.status === "ready") return state;
      return { status: "error", message: action.message, connection: state.connection };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * Traduz uma mensagem do servidor numa ação do reducer.
 * Checagem de exaustividade: se o shared/ws.ts ganhar um evento novo,
 * o front não compila até ele ser tratado aqui.
 */
export function actionFromServer(message: ServerMessage): PollAction | null {
  switch (message.type) {
    case "poll:snapshot":
      return { type: "snapshot", poll: message.poll };
    case "poll:updated":
      return {
        type: "updated",
        pollId: message.pollId,
        totals: message.totals,
        totalVotes: message.totalVotes,
      };
    case "poll:closed":
      return { type: "closed", pollId: message.pollId };
    case "poll:removed":
      return { type: "removed", pollId: message.pollId };
    case "viewers":
      return { type: "viewers", pollId: message.pollId, count: message.count };
    case "error":
      // Uma conexão assina uma enquete por vez: este POLL_NOT_FOUND é sobre a nossa.
      return message.code === "POLL_NOT_FOUND" ? { type: "expired" } : null;
    default: {
      const exhaustive: never = message;
      return exhaustive;
    }
  }
}
