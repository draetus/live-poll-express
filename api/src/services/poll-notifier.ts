import type { Poll } from "../domain/poll.js";

// "Porta" (port) no estilo ports & adapters: o service avisa que algo mudou,
// sem saber QUEM vai ouvir. Em produção, quem implementa é o WsPollNotifier
// (broadcast via WebSocket); nos testes, um notifier falso que só anota as chamadas.
// O service nunca importa nada de ws/.
export interface PollNotifier {
  pollUpdated(poll: Poll): void;
  pollClosed(poll: Poll): void;
  pollRemoved(pollId: string): void;
}
