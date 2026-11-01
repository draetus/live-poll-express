import { buildOptions, type Poll } from "../../src/domain/poll.js";
import type { PollNotifier } from "../../src/services/poll-notifier.js";

type NotifierCall =
  | { event: "updated"; pollId: string }
  | { event: "closed"; pollId: string }
  | { event: "removed"; pollId: string };

// "Spy" escrito à mão: implementa a interface e só anota o que recebeu.
// Graças à interface PollNotifier, o service não percebe que não há WebSocket.
export class FakeNotifier implements PollNotifier {
  readonly calls: NotifierCall[] = [];

  pollUpdated(poll: Poll): void {
    this.calls.push({ event: "updated", pollId: poll.id });
  }

  pollClosed(poll: Poll): void {
    this.calls.push({ event: "closed", pollId: poll.id });
  }

  pollRemoved(pollId: string): void {
    this.calls.push({ event: "removed", pollId });
  }
}

let counter = 0;

// Fábrica de enquetes para testes: valores padrão razoáveis, sobrescreva o que importar.
export function makePoll(overrides: Partial<Poll> = {}): Poll {
  counter++;
  return {
    id: `testPoll${counter}`,
    question: "Test question?",
    options: buildOptions(["Yes", "No"]),
    voters: new Set(),
    adminToken: "admin-token",
    closed: false,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    isSeed: false,
    ...overrides,
  };
}
