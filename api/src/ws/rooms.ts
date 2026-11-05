import { WebSocket } from "ws";
import type { ServerMessage } from "../../../shared/ws.js";

// O mínimo que uma sala precisa de um socket. Depender disto (e não da classe
// WebSocket inteira) permite testar o RoomManager com objetos falsos simples.
export interface RoomSocket {
  readonly readyState: number;
  send(data: string): void;
}

// Salas feitas à mão: cada enquete tem um conjunto de sockets assistindo.
// Decisão: cada socket assiste a NO MÁXIMO uma enquete (uma aba = uma conexão).
export class RoomManager {
  private readonly rooms = new Map<string, Set<RoomSocket>>(); // pollId → sockets
  private readonly socketRoom = new Map<RoomSocket, string>(); // socket → pollId (índice reverso)

  join(socket: RoomSocket, pollId: string): void {
    if (this.socketRoom.get(socket) === pollId) return; // já está nesta sala
    this.leave(socket);

    let room = this.rooms.get(pollId);
    if (!room) {
      room = new Set();
      this.rooms.set(pollId, room);
    }
    room.add(socket);
    this.socketRoom.set(socket, pollId);
    this.broadcastViewers(pollId);
  }

  leave(socket: RoomSocket): void {
    const pollId = this.socketRoom.get(socket);
    if (pollId === undefined) return;
    this.socketRoom.delete(socket);

    const room = this.rooms.get(pollId);
    if (!room) return;
    room.delete(socket);
    if (room.size === 0)
      this.rooms.delete(pollId); // não acumula salas vazias
    else this.broadcastViewers(pollId);
  }

  roomOf(socket: RoomSocket): string | undefined {
    return this.socketRoom.get(socket);
  }

  count(pollId: string): number {
    return this.rooms.get(pollId)?.size ?? 0;
  }

  broadcast(pollId: string, message: ServerMessage): void {
    const room = this.rooms.get(pollId);
    if (!room) return;
    const data = JSON.stringify(message); // serializa UMA vez, não uma vez por socket
    for (const socket of room) {
      // Um socket pode estar fechando (CLOSING) e ainda não ter saído da sala.
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    }
  }

  /** Esvazia a sala sem fechar as conexões (usado quando a enquete é descartada). */
  closeRoom(pollId: string): void {
    const room = this.rooms.get(pollId);
    if (!room) return;
    for (const socket of room) this.socketRoom.delete(socket);
    this.rooms.delete(pollId);
  }

  private broadcastViewers(pollId: string): void {
    this.broadcast(pollId, { type: "viewers", pollId, count: this.count(pollId) });
  }
}
