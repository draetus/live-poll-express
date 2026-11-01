import type { Poll } from "../domain/poll.js";

// O "contrato" do armazenamento. O service depende desta interface, não da classe:
// trocar o Map por Redis ou Postgres no futuro não muda uma linha do service.
export interface PollRepository {
  findById(id: string): Poll | undefined;
  has(id: string): boolean;
  /** Guarda a enquete e devolve os IDs descartados para respeitar o limite. */
  insert(poll: Poll): string[];
  listSeeds(): Poll[];
}

export interface InMemoryPollRepositoryOptions {
  /** Máximo de enquetes NÃO-seed guardadas ao mesmo tempo. */
  maxPolls: number;
}

export class InMemoryPollRepository implements PollRepository {
  // O Map preserva a ordem de inserção: a primeira chave é sempre a mais antiga.
  private readonly polls = new Map<string, Poll>();
  private userPollCount = 0;

  constructor(private readonly options: InMemoryPollRepositoryOptions) {}

  findById(id: string): Poll | undefined {
    return this.polls.get(id);
  }

  has(id: string): boolean {
    return this.polls.has(id);
  }

  insert(poll: Poll): string[] {
    if (this.polls.has(poll.id)) throw new Error(`Duplicate poll id: ${poll.id}`);

    this.polls.set(poll.id, poll);
    if (poll.isSeed) return [];

    this.userPollCount++;
    const evicted: string[] = [];
    while (this.userPollCount > this.options.maxPolls) {
      const oldest = this.findOldestUserPoll();
      if (!oldest) break;
      this.polls.delete(oldest.id);
      this.userPollCount--;
      evicted.push(oldest.id);
    }
    return evicted;
  }

  listSeeds(): Poll[] {
    return [...this.polls.values()].filter((poll) => poll.isSeed);
  }

  private findOldestUserPoll(): Poll | undefined {
    // Percorre em ordem de inserção. As seeds entram primeiro (no boot), então o
    // laço pula só algumas delas antes de achar a enquete de usuário mais antiga.
    for (const poll of this.polls.values()) {
      if (!poll.isSeed) return poll;
    }
    return undefined;
  }
}
