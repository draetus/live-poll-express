import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiErrorBody, CreatePollResponse } from "../../../shared/api.js";
import { postJson, startTestServer, TEST_ORIGIN, type TestServer } from "../helpers/test-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer({ RATE_LIMIT_CREATE_PER_MIN: "2", RATE_LIMIT_VOTE_PER_MIN: "3" });
});

afterAll(async () => {
  await server.close();
});

const createPoll = (headers: Record<string, string> = {}) =>
  postJson(`${server.baseUrl}/polls`, { question: "Rate limit?", options: ["A", "B"] }, headers);

describe("HTTP rate limit", () => {
  it("answers 429 with Retry-After after too many polls from the same IP", async () => {
    expect((await createPoll()).status).toBe(201);
    expect((await createPoll()).status).toBe(201);

    const res = await createPoll({ Origin: TEST_ORIGIN });
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    // O front (outra origem) só consegue ler o header se o CORS o expuser.
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
  });

  it("limits votes separately from poll creation", async () => {
    // A criação já estourou no teste anterior; pegamos uma enquete do seed para votar.
    const [seed] = (await (await fetch(`${server.baseUrl}/polls`)).json()) as { id: string }[];
    const poll = (await (await fetch(`${server.baseUrl}/polls/${seed.id}`)).json()) as {
      options: { id: string }[];
    };
    const vote = () =>
      postJson(`${server.baseUrl}/polls/${seed.id}/votes`, {
        optionId: poll.options[0].id,
        voterId: crypto.randomUUID(),
      });

    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await vote()).status);

    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("uses the client IP from the proxy, not a value the client forged", async () => {
    // Com "trust proxy" = 1, o Express usa só o ÚLTIMO IP do X-Forwarded-For (o que o
    // proxy do Render acrescenta). Aqui não há proxy: o último é este valor, então dois
    // "clientes" diferentes têm contadores separados...
    const other = await createPoll({ "X-Forwarded-For": "198.51.100.7" });
    expect(other.status).toBe(201);

    // ...mas forjar um IP NA FRENTE não adianta: o último continua sendo o mesmo.
    await createPoll({ "X-Forwarded-For": "198.51.100.7" });
    const forged = await createPoll({ "X-Forwarded-For": "1.2.3.4, 198.51.100.7" });
    expect(forged.status).toBe(429);
  });

  it("does not limit reads", async () => {
    const created = (await (
      await createPoll({ "X-Forwarded-For": "198.51.100.99" })
    ).json()) as CreatePollResponse;

    const statuses = [];
    for (let i = 0; i < 10; i++) {
      statuses.push((await fetch(`${server.baseUrl}/polls/${created.poll.id}`)).status);
    }

    expect(new Set(statuses)).toEqual(new Set([200]));
  });
});
