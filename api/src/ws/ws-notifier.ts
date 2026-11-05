import { type Poll, totalVotes } from "../domain/poll.js";
import type { PollNotifier } from "../services/poll-notifier.js";
import type { RoomManager } from "./rooms.js";

// Adaptador: implementa a "porta" PollNotifier usando as salas do WebSocket.
// É aqui, e só aqui, que "algo mudou na enquete" vira "mensagem para os espectadores".
export class WsPollNotifier implements PollNotifier {
  constructor(private readonly rooms: RoomManager) {}

  pollUpdated(poll: Poll): void {
    // Estado COMPLETO (totais de todas as opções), não "+1 na opção 2".
    // Se uma mensagem se perder, a próxima corrige o cliente sozinha.
    this.rooms.broadcast(poll.id, {
      type: "poll:updated",
      pollId: poll.id,
      totals: Object.fromEntries(poll.options.map((option) => [option.id, option.votes])),
      totalVotes: totalVotes(poll),
    });
  }

  pollClosed(poll: Poll): void {
    this.rooms.broadcast(poll.id, { type: "poll:closed", pollId: poll.id });
  }

  pollRemoved(pollId: string): void {
    this.rooms.broadcast(pollId, { type: "poll:removed", pollId });
    this.rooms.closeRoom(pollId); // a enquete não existe mais: ninguém fica "assistindo"
  }
}
