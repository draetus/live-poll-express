import type {
  CreatePollRequest,
  CreatePollResponse,
  PollSummary,
  PollView,
  VoteRequest,
} from "../../../shared/api.js";
import {
  AlreadyVotedError,
  ForbiddenError,
  InvalidOptionError,
  PollClosedError,
  PollNotFoundError,
} from "../domain/errors.js";
import { buildOptions, type Poll, toPollSummary, toPollView } from "../domain/poll.js";
import { generateAdminToken, shortId, tokensMatch } from "../lib/ids.js";
import type { PollRepository } from "../repositories/poll-repository.js";
import type { PollNotifier } from "./poll-notifier.js";

export interface PollServiceOptions {
  /** Gerador de IDs; os testes trocam por um previsível. */
  generateId?: () => string;
  /** Relógio; os testes podem fixar a data. */
  now?: () => Date;
}

const MAX_ID_ATTEMPTS = 10;

// Regras de negócio. Não sabe nada de HTTP (req/res) nem de WebSocket:
// recebe dados já validados e devolve dados ou lança erros de domínio.
export class PollService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repo: PollRepository,
    private readonly notifier: PollNotifier,
    options: PollServiceOptions = {},
  ) {
    this.generateId = options.generateId ?? shortId;
    this.now = options.now ?? (() => new Date());
  }

  listFeatured(): PollSummary[] {
    return this.repo.listSeeds().map(toPollSummary);
  }

  get(pollId: string): PollView {
    return toPollView(this.getPollOrThrow(pollId));
  }

  create(input: CreatePollRequest): CreatePollResponse {
    const poll: Poll = {
      id: this.uniqueId(),
      question: input.question,
      options: buildOptions(input.options),
      voters: new Set(),
      adminToken: generateAdminToken(),
      closed: false,
      createdAt: this.now(),
      isSeed: false,
    };

    const evictedIds = this.repo.insert(poll);
    for (const id of evictedIds) this.notifier.pollRemoved(id);

    // O token sai UMA vez, aqui. Depois disso, nenhuma rota o devolve.
    return { poll: toPollView(poll), adminToken: poll.adminToken };
  }

  vote(pollId: string, { optionId, voterId }: VoteRequest): PollView {
    const poll = this.getPollOrThrow(pollId);
    if (poll.closed) throw new PollClosedError(pollId);

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new InvalidOptionError(optionId);
    if (poll.voters.has(voterId)) throw new AlreadyVotedError(pollId);

    option.votes += 1;
    poll.voters.add(voterId);
    this.notifier.pollUpdated(poll);
    return toPollView(poll);
  }

  close(pollId: string, adminToken: string | undefined): PollView {
    const poll = this.getPollOrThrow(pollId);
    if (!tokensMatch(poll.adminToken, adminToken)) throw new ForbiddenError();

    // Idempotente: encerrar duas vezes não é erro, e só avisa na primeira.
    if (!poll.closed) {
      poll.closed = true;
      this.notifier.pollClosed(poll);
    }
    return toPollView(poll);
  }

  private getPollOrThrow(pollId: string): Poll {
    const poll = this.repo.findById(pollId);
    if (!poll) throw new PollNotFoundError(pollId);
    return poll;
  }

  private uniqueId(): string {
    // Colisão é astronomicamente improvável, mas "improvável" não é "impossível".
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const id = this.generateId();
      if (!this.repo.has(id)) return id;
    }
    throw new Error(`Could not generate a unique poll id after ${MAX_ID_ATTEMPTS} attempts`);
  }
}
