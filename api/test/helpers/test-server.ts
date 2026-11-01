import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { buildServer } from "../../src/build-server.js";
import { parseEnv } from "../../src/config/env.js";

export const TEST_ORIGIN = "http://allowed.test";

export interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

// Sobe o servidor REAL na porta 0 (o sistema operacional escolhe uma porta livre).
export async function startTestServer(env: Record<string, string> = {}): Promise<TestServer> {
  const { server } = buildServer(
    parseEnv({ NODE_ENV: "test", LOG_LEVEL: "silent", CORS_ORIGINS: TEST_ORIGIN, ...env }),
  );

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
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
