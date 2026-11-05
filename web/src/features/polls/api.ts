import type {
  CreatePollRequest,
  CreatePollResponse,
  PollSummary,
  PollView,
  VoteRequest,
} from "@shared/api";
import { request } from "../../lib/http";

// Uma função por rota da API, com os tipos do contrato compartilhado.
// encodeURIComponent: um ID vindo da URL nunca deve conseguir mudar o caminho chamado.
const pollPath = (pollId: string) => `/polls/${encodeURIComponent(pollId)}`;

export const pollsApi = {
  listFeatured: (signal?: AbortSignal) => request<PollSummary[]>("/polls", { signal }),

  get: (pollId: string, signal?: AbortSignal) => request<PollView>(pollPath(pollId), { signal }),

  create: (body: CreatePollRequest) =>
    request<CreatePollResponse>("/polls", { method: "POST", body }),

  vote: (pollId: string, body: VoteRequest) =>
    request<PollView>(`${pollPath(pollId)}/votes`, { method: "POST", body }),

  close: (pollId: string, adminToken: string) =>
    request<PollView>(`${pollPath(pollId)}/close`, {
      method: "POST",
      headers: { "X-Admin-Token": adminToken },
    }),
};
