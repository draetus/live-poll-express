import type { PollSummary, PollView } from "../../../shared/api.js";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

// Modelo INTERNO: o que o servidor guarda. Nunca é enviado diretamente ao cliente.
export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  voters: Set<string>; // interno: quem já votou (nunca serializado)
  adminToken: string; // interno: nunca sai num GET
  closed: boolean;
  createdAt: Date;
  isSeed: boolean; // seeds não são descartadas e aparecem no GET /polls
}

export function totalVotes(poll: Poll): number {
  return poll.options.reduce((sum, option) => sum + option.votes, 0);
}

// Modelos de SAÍDA: escolhemos campo a campo o que vai para fora.
// Como copiamos explicitamente, `voters` e `adminToken` não têm como vazar por acidente.
export function toPollView(poll: Poll): PollView {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options.map(({ id, text, votes }) => ({ id, text, votes })),
    totalVotes: totalVotes(poll),
    closed: poll.closed,
    createdAt: poll.createdAt.toISOString(),
  };
}

export function toPollSummary(poll: Poll): PollSummary {
  return {
    id: poll.id,
    question: poll.question,
    totalVotes: totalVotes(poll),
    closed: poll.closed,
  };
}

// IDs das opções: "1", "2", "3"... Só precisam ser únicos DENTRO da enquete.
export function buildOptions(texts: readonly string[]): PollOption[] {
  return texts.map((text, index) => ({ id: String(index + 1), text, votes: 0 }));
}
