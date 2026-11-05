import { buildServer } from "./build-server.js";
import { loadEnv } from "./config/env.js";

// Entrypoint: única parte do código com efeitos "globais" (porta, sinais, process.exit).
const env = loadEnv();
const { server, wss, logger } = buildServer(env);

server.on("error", (err) => {
  // Ex.: EADDRINUSE quando a porta já está ocupada por outro processo.
  logger.fatal({ err }, "server failed to start");
  process.exit(1);
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "listening");
});

// Graceful shutdown: o Render manda SIGTERM a cada deploy; Ctrl+C no terminal manda SIGINT.
// Paramos de aceitar conexões, deixamos as em andamento terminarem e saímos.
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  // Conexões WebSocket não terminam sozinhas: avisamos com 1001 ("going away"),
  // e o cliente do front reconecta quando o servidor novo subir.
  for (const ws of wss.clients) ws.close(1001, "Server shutting down");
  wss.close(); // para o heartbeat

  server.close((err) => {
    if (err) logger.error({ err }, "error while closing server");
    process.exit(err ? 1 : 0);
  });

  // Rede de segurança: se alguma conexão travar o close, sai à força em 10 s.
  // unref() impede que este timer, sozinho, mantenha o processo vivo.
  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
