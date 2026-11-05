import type { PollView } from "@shared/api";

// Estado da página de uma enquete. Cada "status" carrega só os dados que fazem
// sentido nele: não existe "carregando E com erro E com enquete" ao mesmo tempo.
export type PollState =
  | { status: "loading" }
  | { status: "ready"; poll: PollView }
  | { status: "not-found" }
  | { status: "error"; message: string };

// Fase 5: chegam as ações vindas do WebSocket (snapshot, updated, closed, viewers...).
export type PollAction =
  | { type: "loaded"; poll: PollView }
  | { type: "notFound" }
  | { type: "failed"; message: string };

export const initialPollState: PollState = { status: "loading" };

// Reducer: (estado atual, ação) → próximo estado. Função PURA: não chama API,
// não lê storage, não muda nada fora dela. Por isso é trivial de testar.
export function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case "loaded":
      return { status: "ready", poll: action.poll };
    case "notFound":
      return { status: "not-found" };
    case "failed":
      // Se já temos a enquete na tela, uma falha ao recarregar não deve apagá-la.
      return state.status === "ready" ? state : { status: "error", message: action.message };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
