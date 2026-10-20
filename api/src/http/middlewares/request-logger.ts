import type { RequestHandler } from "express";
import type { Logger } from "../../lib/logger.js";

// Registra método, rota, status e duração quando a resposta termina de ser enviada.
// Substitui o pacote pino-http em ~15 linhas.
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();

    res.on("finish", () => {
      const entry = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - start),
      };
      if (res.statusCode >= 500) logger.error(entry, "request failed");
      else if (res.statusCode >= 400) logger.warn(entry, "request rejected");
      // O Render chama /health o tempo todo; em "info" isso afogaria os logs úteis.
      else if (req.path === "/health") logger.debug(entry, "health check");
      else logger.info(entry, "request completed");
    });

    next();
  };
}
