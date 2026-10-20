// Contratos do WebSocket. O campo `type` é o discriminador:
// com ele, um `switch (msg.type)` faz o TypeScript saber o formato de cada mensagem.
import type { PollView } from "./api.js";

// Cliente → servidor
export type ClientMessage =
  | { type: "subscribe"; pollId: string }
  | { type: "unsubscribe"; pollId: string };

// Servidor → cliente
export type ServerMessage =
  | { type: "poll:snapshot"; poll: PollView }
  | { type: "poll:updated"; pollId: string; totals: Record<string, number>; totalVotes: number }
  | { type: "poll:closed"; pollId: string }
  | { type: "poll:removed"; pollId: string } // descartada por limite de memória
  | { type: "viewers"; pollId: string; count: number }
  | { type: "error"; code: WsErrorCode; message: string };

export type WsErrorCode = "INVALID_MESSAGE" | "POLL_NOT_FOUND" | "RATE_LIMITED";
