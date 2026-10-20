import { createServer } from "node:http";
import type { Env } from "./config/env.js";
import { createApp } from "./http/app.js";
import { createLogger } from "./lib/logger.js";

// Composition root: o ÚNICO lugar que conhece e conecta todas as peças.
// Não chama listen() — quem decide a porta é o server.ts (produção) ou o teste (porta 0).
// Nas próximas fases, repositório, service, salas e WebSocket também nascem aqui.
export function buildServer(env: Env) {
  const logger = createLogger(env);
  const app = createApp({ env, logger });
  // Criamos o http.Server explicitamente (em vez de app.listen) porque, na fase 3,
  // o WebSocket vai se pendurar neste mesmo servidor, no evento "upgrade".
  const server = createServer(app);

  return { app, server, logger };
}
