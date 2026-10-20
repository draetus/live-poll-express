import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../../src/build-server.js";
import { parseEnv } from "../../src/config/env.js";

const ALLOWED_ORIGIN = "http://allowed.test";

// Servidor REAL (Express + http.Server), na porta 0: o sistema operacional escolhe
// uma porta livre, então os testes nunca brigam com outro processo pela porta 3000.
const { server } = buildServer(
  parseEnv({ NODE_ENV: "test", LOG_LEVEL: "silent", CORS_ORIGINS: ALLOWED_ORIGIN }),
);
let baseUrl: string;

beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.close();
  await once(server, "close");
});

describe("GET /health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("does not expose the X-Powered-By header", async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.headers.has("x-powered-by")).toBe(false);
  });
});

describe("CORS", () => {
  it("allows a configured origin", async () => {
    const res = await fetch(`${baseUrl}/health`, { headers: { Origin: ALLOWED_ORIGIN } });

    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
  });

  it("does not allow an unknown origin", async () => {
    const res = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://evil.test" } });

    // O servidor ainda responde (CORS não é autenticação!), mas sem o header,
    // o NAVEGADOR impede o JavaScript do site evil.test de ler a resposta.
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("answers the preflight and allows the X-Admin-Token header", async () => {
    const res = await fetch(`${baseUrl}/polls/abc/close`, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "x-admin-token",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/X-Admin-Token/i);
  });
});
