import { createServer } from "node:http";
import type { Env } from "./config/env.js";
import { parseSeed } from "./data/seed.js";
import seedData from "./data/seed.json" with { type: "json" };
import { createApp } from "./http/app.js";
import { createLogger } from "./lib/logger.js";
import { InMemoryPollRepository } from "./repositories/poll-repository.js";
import { noopNotifier } from "./services/poll-notifier.js";
import { PollService } from "./services/poll-service.js";

// Composition root: o ÚNICO lugar que conhece e conecta todas as peças.
// Não chama listen() — quem decide a porta é o server.ts (produção) ou o teste (porta 0).
export function buildServer(env: Env) {
  const logger = createLogger(env);

  const repo = new InMemoryPollRepository({ maxPolls: env.MAX_POLLS });
  for (const poll of parseSeed(seedData, new Date())) repo.insert(poll);

  // Fase 3: noopNotifier será trocado pelo WsPollNotifier (broadcast via WebSocket).
  // Repare que nada mais muda: o service só conhece a interface PollNotifier.
  const service = new PollService(repo, noopNotifier);

  const app = createApp({ env, logger, service });
  // Criamos o http.Server explicitamente (em vez de app.listen) porque, na fase 3,
  // o WebSocket vai se pendurar neste mesmo servidor, no evento "upgrade".
  const server = createServer(app);

  return { app, server, logger, service };
}
