import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { type RawData, WebSocket, WebSocketServer } from "ws";
import type { ServerMessage } from "../../../shared/ws.js";
import { PollNotFoundError } from "../domain/errors.js";
import type { Logger } from "../lib/logger.js";
import type { PollService } from "../services/poll-service.js";
import { DEFAULT_MESSAGE_LIMIT, type MessageLimit, MessageLimiter } from "./message-limiter.js";
import { parseClientMessage } from "./protocol.js";
import type { RoomManager } from "./rooms.js";

export const WS_PATH = "/ws";
export const MAX_MESSAGE_BYTES = 1024;
export const DEFAULT_HEARTBEAT_MS = 30_000;

export interface WsDeps {
  rooms: RoomManager;
  service: PollService;
  logger: Logger;
  isAllowedOrigin(origin: string | undefined): boolean;
  heartbeatIntervalMs?: number;
  messageLimit?: MessageLimit;
}

// O navegador SEMPRE envia Origin no handshake de WebSocket. Por isso, aqui, exigir
// o header não custa nada (diferente do HTTP, em que curl e health checks não o enviam).
export function makeOriginCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (origin: string | undefined): boolean => origin !== undefined && allowed.has(origin);
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  // Ainda estamos no protocolo HTTP: respondemos "à mão" e fechamos o socket TCP.
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

// RawData pode chegar em três formatos: Buffer (o padrão), lista de Buffers
// (mensagem fragmentada) ou ArrayBuffer. Convertemos qualquer um para texto.
function rawToText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return data.toString("utf8");
}

export function attachWebSocket(server: Server, deps: WsDeps): WebSocketServer {
  // noServer: o ws NÃO escuta o upgrade sozinho; nós decidimos quem entra (Origin, caminho).
  // maxPayload: mensagens acima de 1 KB fazem o próprio ws fechar a conexão com 1009.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  // "upgrade": o cliente pediu para trocar HTTP por WebSocket nesta mesma conexão TCP.
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Erros no socket cru (cliente desconectou no meio do handshake, por exemplo)
    // sem listener derrubariam o processo inteiro.
    socket.on("error", (err) => deps.logger.debug({ err }, "upgrade socket error"));

    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname !== WS_PATH) return rejectUpgrade(socket, 404, "Not Found");

    const origin = req.headers.origin;
    if (!deps.isAllowedOrigin(origin)) {
      deps.logger.warn({ origin }, "websocket upgrade rejected: origin not allowed");
      return rejectUpgrade(socket, 403, "Forbidden");
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  // Heartbeat: a cada intervalo, quem não respondeu ao ping anterior é derrubado.
  // Isso limpa conexões "zumbis" (Wi-Fi caiu sem avisar) e mantém a conexão ativa
  // aos olhos do proxy do Render, que fecha conexões ociosas.
  const alive = new WeakMap<WebSocket, boolean>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate(); // sem handshake de fechamento: o outro lado já não responde
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS);
  heartbeat.unref(); // sozinho, este timer não mantém o processo vivo
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: WebSocket) => {
    alive.set(ws, true);
    ws.on("pong", () => alive.set(ws, true));
    handleConnection(ws, deps);
  });

  return wss;
}

function handleConnection(ws: WebSocket, deps: WsDeps): void {
  const limiter = new MessageLimiter(deps.messageLimit ?? DEFAULT_MESSAGE_LIMIT);
  deps.logger.debug("websocket connected");

  ws.on("message", (data: RawData, isBinary: boolean) => {
    // Uma exceção dentro de um listener de evento NÃO passa por nenhum errorHandler:
    // derrubaria o processo e desconectaria todo mundo. Isolamos o erro nesta conexão.
    try {
      handleMessage(ws, deps, limiter, data, isBinary);
    } catch (err) {
      deps.logger.error({ err }, "unexpected error handling websocket message");
      ws.close(1011, "Internal error"); // 1011 = erro inesperado no servidor
    }
  });

  ws.on("close", (code: number) => {
    deps.rooms.leave(ws); // sem isto, a sala guardaria sockets mortos para sempre
    deps.logger.debug({ code }, "websocket disconnected");
  });

  // Ex.: mensagem acima do maxPayload. O ws emite "error" e depois fecha a conexão.
  // Um EventEmitter que emite "error" SEM listener derruba o processo Node inteiro.
  ws.on("error", (err) => deps.logger.warn({ err }, "websocket error"));
}

function handleMessage(
  ws: WebSocket,
  { rooms, service }: WsDeps,
  limiter: MessageLimiter,
  data: RawData,
  isBinary: boolean,
): void {
  const verdict = limiter.hit();
  if (verdict === "drop") return;
  if (verdict === "disconnect") {
    ws.close(1008, "Rate limit exceeded"); // 1008 = policy violation
    return;
  }
  if (verdict === "warn") {
    send(ws, { type: "error", code: "RATE_LIMITED", message: "Too many messages" });
    return;
  }

  const parsed = parseClientMessage(rawToText(data), isBinary);
  if (!parsed.ok) {
    send(ws, { type: "error", code: "INVALID_MESSAGE", message: parsed.reason });
    return;
  }

  const message = parsed.message;
  switch (message.type) {
    case "subscribe": {
      let poll: ReturnType<PollService["get"]>;
      try {
        poll = service.get(message.pollId);
      } catch (err) {
        if (!(err instanceof PollNotFoundError)) throw err; // inesperado: sobe para o catch acima
        send(ws, { type: "error", code: "POLL_NOT_FOUND", message: err.message });
        return;
      }
      // Snapshot ANTES de entrar na sala: o cliente recebe o estado completo e,
      // logo depois, o "viewers" já contando com ele.
      send(ws, { type: "poll:snapshot", poll });
      rooms.join(ws, message.pollId);
      return;
    }
    case "unsubscribe": {
      if (rooms.roomOf(ws) === message.pollId) rooms.leave(ws);
      return;
    }
    default: {
      // Checagem de exaustividade: se o shared/ws.ts ganhar um tipo novo de mensagem
      // do cliente, esta linha deixa de compilar até ele ser tratado acima.
      const exhaustive: never = message;
      throw new Error(`Unhandled client message: ${JSON.stringify(exhaustive)}`);
    }
  }
}
