import express, { type Express } from "express";
import type { Env } from "../config/env.js";
import type { Logger } from "../lib/logger.js";
import { corsMiddleware } from "./middlewares/cors.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { healthRouter } from "./routes/health.js";

export interface AppDeps {
  env: Env;
  logger: Logger;
}

// Fábrica do app Express. Recebe as dependências por parâmetro (nada de import global),
// o que permite aos testes montar o app com configuração própria.
export function createApp({ env, logger }: AppDeps): Express {
  const app = express();

  // O Render fica atrás de 1 proxy. Sem isto, req.ip seria o IP do proxy
  // (e o rate limit da fase 7 trataria todo mundo como o mesmo cliente).
  app.set("trust proxy", 1);
  // Não anunciar "X-Powered-By: Express" de graça para quem procura alvos.
  app.disable("x-powered-by");

  // A ORDEM dos app.use importa: cada requisição passa pelos middlewares de cima para baixo.
  app.use(requestLogger(logger)); // 1º: registra tudo, inclusive preflights e erros
  app.use(corsMiddleware(env.CORS_ORIGINS)); // 2º: responde preflight antes de qualquer rota
  app.use(express.json({ limit: "10kb" })); // 3º: transforma o body JSON em req.body

  app.use(healthRouter());

  return app;
}
