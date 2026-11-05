import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { type BuildServerOptions, buildServer } from "../../src/build-server.js";
import { parseEnv } from "../../src/config/env.js";
import type { PollService } from "../../src/services/poll-service.js";

export const TEST_ORIGIN = "http://allowed.test";

export interface TestServer {
  baseUrl: string;
  wsUrl: string;
  service: PollService;
  close(): Promise<void>;
}

// Sobe o servidor REAL na porta 0 (o sistema operacional escolhe uma porta livre).
export async function startTestServer(
  env: Record<string, string> = {},
  options: BuildServerOptions = {},
): Promise<TestServer> {
  const { server, wss, service } = buildServer(
    parseEnv({ NODE_ENV: "test", LOG_LEVEL: "silent", CORS_ORIGINS: TEST_ORIGIN, ...env }),
    options,
  );

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    service,
    async close() {
      // Conexões WebSocket abertas impediriam o server.close() de terminar.
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      server.close();
      await once(server, "close");
    },
  };
}

// Atalho para POST com JSON.
export function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
