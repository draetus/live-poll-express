import type { ClientMessage, ServerMessage } from "@shared/ws";
import type { SocketLike } from "../lib/realtime-client";

// WebSocket de mentira, controlado pelo teste: em vez de rede, métodos que
// simulam o que o servidor faria (abrir, mandar mensagem, cair).
export class FakeWebSocket implements SocketLike {
  readyState = 0; // CONNECTING
  readonly sent: ClientMessage[] = [];
  closedByClient = false;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    if (this.readyState !== 1) throw new Error("send() on a socket that is not open");
    this.sent.push(JSON.parse(data) as ClientMessage);
  }

  // Como no navegador: close() não fecha na hora; o evento "close" chega DEPOIS.
  close(code = 1000): void {
    this.closedByClient = true;
    this.readyState = 2; // CLOSING
    setTimeout(() => {
      this.readyState = 3;
      this.onclose?.(new CloseEvent("close", { code }));
    }, 0);
  }

  // ---- controles do teste ----

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  receive(message: ServerMessage): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) }));
  }

  /** A conexão cai (rede, deploy...). 1006 = queda sem handshake de fechamento. */
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

/** Fábrica que guarda todos os sockets criados, em ordem. */
export function fakeSocketFactory() {
  const sockets: FakeWebSocket[] = [];
  return {
    sockets,
    createSocket: (url: string) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
    latest(): FakeWebSocket {
      const socket = sockets.at(-1);
      if (!socket) throw new Error("No socket was created yet");
      return socket;
    },
  };
}
