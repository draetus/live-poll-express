import { once } from "node:events";
import { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../../../shared/ws.js";
import { TEST_ORIGIN } from "./test-server.js";

type Predicate = (message: ServerMessage) => boolean;

interface Waiter {
  predicate: Predicate;
  resolve(message: ServerMessage): void;
}

// Cliente WebSocket para testes. O detalhe que importa: ele GUARDA toda mensagem
// que chega desde a conexão. Assim, "esperar a próxima mensagem X" funciona mesmo
// que X tenha chegado antes de o teste começar a esperar (snapshot e viewers chegam
// quase juntos, e um listener registrado tarde demais perderia um deles).
export class TestClient {
  private readonly inbox: ServerMessage[] = [];
  private readonly waiters: Waiter[] = [];

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      const index = this.waiters.findIndex((w) => w.predicate(message));
      if (index === -1) {
        this.inbox.push(message);
        return;
      }
      const [waiter] = this.waiters.splice(index, 1);
      waiter.resolve(message);
    });
  }

  /** origin: `null` = não enviar o header (como um script fora do navegador). */
  static async connect(url: string, options: { origin?: string | null; autoPong?: boolean } = {}) {
    const origin = options.origin === undefined ? TEST_ORIGIN : options.origin;
    const ws = new WebSocket(url, {
      ...(origin === null ? {} : { origin }),
      autoPong: options.autoPong ?? true,
    });
    const client = new TestClient(ws);
    await once(ws, "open");
    return client;
  }

  send(message: ClientMessage | string): void {
    this.ws.send(typeof message === "string" ? message : JSON.stringify(message));
  }

  /** Próxima mensagem que satisfaz o predicado (já recebida ou futura). Rejeita por timeout. */
  next(predicate: Predicate = () => true, timeoutMs = 1000): Promise<ServerMessage> {
    const index = this.inbox.findIndex(predicate);
    if (index !== -1) return Promise.resolve(this.inbox.splice(index, 1)[0]);

    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        predicate,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
      };
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`Timed out after ${timeoutMs} ms waiting for a message`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  /** Atalho tipado: próxima mensagem de um `type`. */
  nextOfType<T extends ServerMessage["type"]>(type: T, timeoutMs?: number) {
    return this.next((m) => m.type === type, timeoutMs) as Promise<
      Extract<ServerMessage, { type: T }>
    >;
  }

  /** Garante que NENHUMA mensagem do predicado chega dentro da janela. */
  async expectNothing(predicate: Predicate = () => true, windowMs = 150): Promise<void> {
    const arrived = await this.next(predicate, windowMs).then(
      (message) => message,
      () => undefined,
    );
    if (arrived) throw new Error(`Expected no message, got ${JSON.stringify(arrived)}`);
  }

  async closed(): Promise<{ code: number; reason: string }> {
    if (this.ws.readyState === WebSocket.CLOSED) throw new Error("Already closed");
    const [code, reason] = (await once(this.ws, "close")) as [number, Buffer];
    return { code, reason: reason.toString() };
  }

  close(): void {
    this.ws.close();
  }
}
