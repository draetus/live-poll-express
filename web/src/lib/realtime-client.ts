import type { ClientMessage, ServerMessage } from "@shared/ws";

export type ConnectionState = "idle" | "connecting" | "open" | "reconnecting";

// O mínimo de um WebSocket que o cliente usa. O navegador fornece o real;
// os testes passam um falso, controlado à mão.
export interface SocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface RealtimeClientOptions {
  url: string;
  createSocket?: (url: string) => SocketLike;
  /** Fonte de aleatoriedade do jitter; os testes fixam o valor. */
  random?: () => number;
}

const OPEN = 1; // WebSocket.OPEN
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;
const POLICY_VIOLATION = 1008; // o servidor nos expulsou por abuso: não insistir

type Listener<T> = (value: T) => void;

/**
 * Uma conexão WebSocket por aba, compartilhada pelo app inteiro.
 *
 * Guarda a INTENÇÃO (`desiredPollId`: o que deveria estar assinado), não só o estado
 * da conexão. Assim, ao reconectar, ele mesmo assina de novo, e quem usa nem percebe
 * que a conexão caiu.
 */
export class RealtimeClient {
  private socket?: SocketLike;
  private state: ConnectionState = "idle";
  private attempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private desiredPollId?: string;
  private active = false;
  private readonly messageListeners = new Set<Listener<ServerMessage>>();
  private readonly stateListeners = new Set<Listener<ConnectionState>>();
  private readonly createSocket: (url: string) => SocketLike;
  private readonly random: () => number;

  constructor(private readonly options: RealtimeClientOptions) {
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.random = options.random ?? Math.random;
  }

  /** Liga o cliente. Ele só abre a conexão quando alguém assina uma enquete. */
  start(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener("online", this.handleOnline);
    if (this.desiredPollId) this.connect();
  }

  /** Desliga tudo: fecha a conexão e cancela reconexões. Pode ser religado com start(). */
  stop(): void {
    this.active = false;
    window.removeEventListener("online", this.handleOnline);
    clearTimeout(this.reconnectTimer);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onclose = null; // este fechamento é nosso: não deve disparar reconexão
      socket.close(1000, "Client stopped");
    }
    this.attempt = 0;
    this.setState("idle");
  }

  subscribe(pollId: string): void {
    this.desiredPollId = pollId;
    if (!this.active) return;
    if (this.socket?.readyState === OPEN) this.send({ type: "subscribe", pollId });
    else if (!this.socket && !this.reconnectTimer) this.connect();
    // conectando ou aguardando reconexão: o onOpen assina quando abrir
  }

  unsubscribe(pollId: string): void {
    if (this.desiredPollId !== pollId) return;
    this.desiredPollId = undefined;
    if (this.socket?.readyState === OPEN) this.send({ type: "unsubscribe", pollId });
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** Devolve a função que cancela a inscrição (padrão usado no cleanup do useEffect). */
  onMessage(listener: Listener<ServerMessage>): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStateChange(listener: Listener<ConnectionState>): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private connect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.setState(this.attempt === 0 ? "connecting" : "reconnecting");

    const socket = this.createSocket(this.options.url);
    this.socket = socket;
    // Eventos chegam de forma assíncrona: um socket ANTIGO (já substituído) ainda pode
    // disparar "close" depois que um novo foi criado. Só o socket atual é ouvido.
    const isCurrent = () => this.socket === socket;

    socket.onopen = () => {
      if (!isCurrent()) return;
      this.attempt = 0;
      this.setState("open");
      if (this.desiredPollId) this.send({ type: "subscribe", pollId: this.desiredPollId });
    };
    socket.onmessage = (event) => {
      if (isCurrent()) this.handleMessage(event.data);
    };
    socket.onclose = (event) => {
      if (isCurrent()) this.handleClose(event.code);
    };
    socket.onerror = () => {
      // Erros de WebSocket no navegador não trazem detalhe; sempre vêm seguidos de "close".
    };
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return; // o servidor nunca deveria mandar isto; ignorar é mais seguro que quebrar
    }
    for (const listener of this.messageListeners) listener(message);
  }

  private handleClose(code: number): void {
    this.socket = undefined;
    if (!this.active) return;
    if (code === POLICY_VIOLATION) {
      this.setState("idle");
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    // Backoff exponencial com teto: 0,5 s, 1 s, 2 s, 4 s... até 15 s.
    const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt);
    this.attempt++;
    // Jitter: sorteia entre metade e o total do intervalo. Quando o servidor volta,
    // os clientes não reconectam todos no mesmo milissegundo.
    const delay = base / 2 + this.random() * (base / 2);
    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // Arrow function como propriedade: `this` continua apontando para a instância,
  // e a MESMA referência serve para add e removeEventListener.
  private readonly handleOnline = () => {
    if (!this.active || this.socket) return;
    this.attempt = 0; // a rede voltou: tenta já, sem esperar o backoff
    if (this.desiredPollId) this.connect();
  };

  private send(message: ClientMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }
}
