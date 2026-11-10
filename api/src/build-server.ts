import { createServer } from "node:http";
import type { Env } from "./config/env.js";
import { parseSeed } from "./data/seed.js";
import seedData from "./data/seed.json" with { type: "json" };
import { createApp } from "./http/app.js";
import { createLogger } from "./lib/logger.js";
import { InMemoryPollRepository } from "./repositories/poll-repository.js";
import { PollService } from "./services/poll-service.js";
import type { MessageLimit } from "./ws/message-limiter.js";
import { RoomManager } from "./ws/rooms.js";
import { WsPollNotifier } from "./ws/ws-notifier.js";
import { attachWebSocket, makeOriginCheck } from "./ws/ws-server.js";

// Ajustes que os testes usam para não precisar esperar 30 s por um heartbeat.
export interface BuildServerOptions {
  heartbeatIntervalMs?: number;
  wsMessageLimit?: MessageLimit;
}

// Composition root: o ÚNICO lugar que conhece e conecta todas as peças.
// Não chama listen() — quem decide a porta é o server.ts (produção) ou o teste (porta 0).
export function buildServer(env: Env, options: BuildServerOptions = {}) {
  const logger = createLogger(env);

  const repo = new InMemoryPollRepository({ maxPolls: env.MAX_POLLS });
  for (const poll of parseSeed(seedData, new Date())) repo.insert(poll);

  // As salas são compartilhadas: o notifier faz broadcast nelas,
  // e o servidor WebSocket coloca e tira conexões delas.
  const rooms = new RoomManager();
  // Na fase 2 era o noopNotifier. Trocar por este foi a ÚNICA mudança necessária
  // para o service passar a avisar em tempo real: ele só conhece a interface.
  const notifier = new WsPollNotifier(rooms);
  const service = new PollService(repo, notifier);

  const app = createApp({ env, logger, service });
  // HTTP (Express) e WebSocket dividem o MESMO servidor e a MESMA porta:
  // o WebSocket entra pelo evento "upgrade" deste http.Server.
  const server = createServer(app);
  const wss = attachWebSocket(server, {
    rooms,
    service,
    logger,
    isAllowedOrigin: makeOriginCheck(env.CORS_ORIGINS),
    heartbeatIntervalMs: options.heartbeatIntervalMs,
    messageLimit: options.wsMessageLimit ?? { max: env.WS_MESSAGES_PER_10S, windowMs: 10_000 },
  });

  return { app, server, wss, logger, service };
}
