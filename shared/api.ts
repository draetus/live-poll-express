// Contratos da API REST: o formato exato do que trafega entre web/ e api/.
// Só tipos (somem no JavaScript gerado) — nenhum import de pacote.

export interface HealthResponse {
  status: "ok";
}

export interface PollOptionView {
  id: string;
  text: string;
  votes: number;
}

export interface PollView {
  id: string;
  question: string;
  options: PollOptionView[];
  totalVotes: number;
  closed: boolean;
  createdAt: string; // ISO 8601 — datas trafegam como string no contrato
}

export interface PollSummary {
  id: string;
  question: string;
  totalVotes: number;
  closed: boolean;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
}

export interface CreatePollResponse {
  poll: PollView;
  adminToken: string; // devolvido APENAS na criação
}

export interface VoteRequest {
  optionId: string;
  voterId: string; // UUID gerado no navegador
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "POLL_NOT_FOUND"
  | "POLL_CLOSED"
  | "INVALID_OPTION"
  | "ALREADY_VOTED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string; // em inglês, para devs; o front mostra texto próprio a partir do code
    details?: { path: string; message: string }[];
  };
}
