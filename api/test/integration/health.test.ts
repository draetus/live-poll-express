import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TEST_ORIGIN, type TestServer } from "../helpers/test-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe("GET /health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await fetch(`${server.baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("does not expose the X-Powered-By header", async () => {
    const res = await fetch(`${server.baseUrl}/health`);

    expect(res.headers.has("x-powered-by")).toBe(false);
  });
});

describe("CORS", () => {
  it("allows a configured origin", async () => {
    const res = await fetch(`${server.baseUrl}/health`, { headers: { Origin: TEST_ORIGIN } });

    expect(res.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
  });

  it("does not allow an unknown origin", async () => {
    const res = await fetch(`${server.baseUrl}/health`, {
      headers: { Origin: "http://evil.test" },
    });

    // O servidor ainda responde (CORS não é autenticação!), mas sem o header,
    // o NAVEGADOR impede o JavaScript do site evil.test de ler a resposta.
    expect(res.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("answers the preflight and allows the X-Admin-Token header", async () => {
    const res = await fetch(`${server.baseUrl}/polls/abc/close`, {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "x-admin-token",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/X-Admin-Token/i);
  });
});
