import { Router } from "express";
import type { HealthResponse } from "../../../../shared/api.js";

// Rota que não toca em nada: só prova que o processo está de pé.
// Usada pelo health check do Render e pelo front para detectar o cold start.
export function healthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" } satisfies HealthResponse);
  });

  return router;
}
