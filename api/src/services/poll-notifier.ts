import type { Poll } from "../domain/poll.js";

// "Porta" (port) no estilo ports & adapters: o service avisa que algo mudou,
// sem saber QUEM vai ouvir. Na fase 3, o WsPollNotifier implementa isto
// fazendo broadcast pelo WebSocket. O service nunca importa nada de ws/.
export interface PollNotifier {
  pollUpdated(poll: Poll): void;
  pollClosed(poll: Poll): void;
  pollRemoved(pollId: string): void;
}

// Implementação que não faz nada: usada enquanto ainda não existe WebSocket.
export const noopNotifier: PollNotifier = {
  pollUpdated() {},
  pollClosed() {},
  pollRemoved() {},
};
