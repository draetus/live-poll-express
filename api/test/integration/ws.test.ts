import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { CreatePollResponse } from "../../../shared/api.js";
import { postJson, startTestServer, TEST_ORIGIN, type TestServer } from "../helpers/test-server.js";
import { TestClient } from "../helpers/ws-client.js";

let server: TestServer;
const openClients: TestClient[] = [];

async function connect(options?: Parameters<typeof TestClient.connect>[1], target = server) {
  const client = await TestClient.connect(target.wsUrl, options);
  openClients.push(client);
  return client;
}

async function createPoll(target = server): Promise<CreatePollResponse> {
  const res = await postJson(`${target.baseUrl}/polls`, {
    question: "Best day?",
    options: ["Saturday", "Sunday"],
  });
  return (await res.json()) as CreatePollResponse;
}

function vote(pollId: string, optionId: string, target = server) {
  return postJson(`${target.baseUrl}/polls/${pollId}/votes`, {
    optionId,
    voterId: crypto.randomUUID(),
  });
}

// Tenta o handshake e devolve a mensagem de erro (que traz o status HTTP da recusa).
function failedUpgrade(url: string, origin: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, origin === null ? {} : { origin });
    ws.on("open", () => {
      ws.close();
      reject(new Error("Upgrade was unexpectedly accepted"));
    });
    ws.on("error", (err) => resolve(err.message));
  });
}

beforeAll(async () => {
  server = await startTestServer();
});

afterEach(() => {
  for (const client of openClients.splice(0)) client.ws.terminate();
});

afterAll(async () => {
  await server.close();
});

describe("handshake", () => {
  it("accepts an allowed Origin on /ws", async () => {
    const client = await connect();

    expect(client.ws.readyState).toBe(WebSocket.OPEN);
  });

  it("rejects an unknown Origin with 403", async () => {
    expect(await failedUpgrade(server.wsUrl, "http://evil.test")).toMatch(/403/);
  });

  it("rejects a missing Origin with 403", async () => {
    expect(await failedUpgrade(server.wsUrl, null)).toMatch(/403/);
  });

  it("rejects other paths with 404", async () => {
    const url = server.wsUrl.replace("/ws", "/other");

    expect(await failedUpgrade(url, TEST_ORIGIN)).toMatch(/404/);
  });
});

describe("subscribe", () => {
  it("sends the snapshot first and then the viewers count", async () => {
    const client = await connect();

    client.send({ type: "subscribe", pollId: "seedTabs" });

    const first = await client.next();
    expect(first.type).toBe("poll:snapshot");
    expect(first.type === "poll:snapshot" && first.poll.id).toBe("seedTabs");
    expect(await client.next()).toEqual({ type: "viewers", pollId: "seedTabs", count: 1 });
  });

  it("answers POLL_NOT_FOUND for an unknown poll", async () => {
    const client = await connect();

    client.send({ type: "subscribe", pollId: "zzzzzzzz" });

    expect(await client.next()).toMatchObject({ type: "error", code: "POLL_NOT_FOUND" });
  });

  it("updates the viewers count for everyone as people join and leave", async () => {
    const { poll } = await createPoll();
    const alice = await connect();
    const bob = await connect();
    alice.send({ type: "subscribe", pollId: poll.id });
    await alice.next((m) => m.type === "viewers" && m.count === 1);

    bob.send({ type: "subscribe", pollId: poll.id });
    expect(await alice.nextOfType("viewers")).toMatchObject({ count: 2 });
    expect(await bob.nextOfType("viewers")).toMatchObject({ count: 2 });

    bob.close();
    expect(await alice.nextOfType("viewers")).toMatchObject({ count: 1 });
  });

  it("stops receiving updates after unsubscribe", async () => {
    const { poll } = await createPoll();
    const client = await connect();
    client.send({ type: "subscribe", pollId: poll.id });
    await client.nextOfType("viewers");

    client.send({ type: "unsubscribe", pollId: poll.id });
    await new Promise((resolve) => setTimeout(resolve, 50)); // dá tempo do servidor processar
    await vote(poll.id, "1");

    await client.expectNothing((m) => m.type === "poll:updated");
  });
});

describe("real-time events", () => {
  it("delivers poll:updated to the poll's room only", async () => {
    const { poll } = await createPoll();
    const watcher = await connect();
    const other = await connect();
    watcher.send({ type: "subscribe", pollId: poll.id });
    other.send({ type: "subscribe", pollId: "seedTabs" });
    await watcher.nextOfType("viewers");
    await other.nextOfType("viewers");

    await vote(poll.id, "2");

    expect(await watcher.nextOfType("poll:updated")).toEqual({
      type: "poll:updated",
      pollId: poll.id,
      totals: { "1": 0, "2": 1 },
      totalVotes: 1,
    });
    await other.expectNothing((m) => m.type === "poll:updated");
  });

  it("delivers poll:closed when the admin closes the poll", async () => {
    const { poll, adminToken } = await createPoll();
    const watcher = await connect();
    watcher.send({ type: "subscribe", pollId: poll.id });
    await watcher.nextOfType("viewers");

    await postJson(`${server.baseUrl}/polls/${poll.id}/close`, {}, { "X-Admin-Token": adminToken });

    expect(await watcher.nextOfType("poll:closed")).toEqual({
      type: "poll:closed",
      pollId: poll.id,
    });
  });

  it("delivers poll:removed when the poll is evicted by the memory limit", async () => {
    const small = await startTestServer({ MAX_POLLS: "1" });
    try {
      const { poll: oldest } = await createPoll(small);
      const watcher = await connect(undefined, small);
      watcher.send({ type: "subscribe", pollId: oldest.id });
      await watcher.nextOfType("viewers");

      await createPoll(small); // passa do limite → a mais antiga é descartada

      expect(await watcher.nextOfType("poll:removed")).toEqual({
        type: "poll:removed",
        pollId: oldest.id,
      });
    } finally {
      await small.close();
    }
  });
});

describe("invalid input", () => {
  it.each([
    ["text that is not JSON", "hello"],
    ["an unknown message type", '{"type":"vote","pollId":"seedTabs"}'],
  ])("answers INVALID_MESSAGE for %s and keeps the connection open", async (_label, text) => {
    const client = await connect();

    client.send(text);

    expect(await client.next()).toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
    client.send({ type: "subscribe", pollId: "seedTabs" });
    expect(await client.nextOfType("poll:snapshot")).toBeDefined();
  });

  it("answers INVALID_MESSAGE for binary frames", async () => {
    const client = await connect();

    client.ws.send(Buffer.from('{"type":"subscribe","pollId":"seedTabs"}'), { binary: true });

    expect(await client.next()).toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
  });

  it("closes the connection with 1009 for a message over 1 KB", async () => {
    const client = await connect();
    const closed = client.closed();

    client.send("x".repeat(2000));

    expect((await closed).code).toBe(1009);
  });
});

describe("unexpected errors", () => {
  it("closes only the affected connection with 1011 and keeps the server running", async () => {
    const isolated = await startTestServer();
    try {
      // Força um bug: qualquer get() passa a lançar um erro que não é PollNotFoundError.
      vi.spyOn(isolated.service, "get").mockImplementation(() => {
        throw new Error("simulated bug");
      });
      const victim = await connect(undefined, isolated);
      const bystander = await connect(undefined, isolated);
      const closed = victim.closed();

      victim.send({ type: "subscribe", pollId: "seedTabs" });

      expect((await closed).code).toBe(1011);
      expect(bystander.ws.readyState).toBe(WebSocket.OPEN);
      const health = await fetch(`${isolated.baseUrl}/health`);
      expect(health.status).toBe(200);
    } finally {
      vi.restoreAllMocks();
      await isolated.close();
    }
  });
});

describe("rate limit per connection", () => {
  it("warns with RATE_LIMITED, then disconnects with 1008 on a repeat offense", async () => {
    const limited = await startTestServer({}, { wsMessageLimit: { max: 3, windowMs: 300 } });
    try {
      const client = await connect(undefined, limited);
      const subscribe = { type: "subscribe", pollId: "seedTabs" } as const;
      for (let i = 0; i < 4; i++) client.send(subscribe);
      expect(await client.nextOfType("error")).toMatchObject({ code: "RATE_LIMITED" });

      await new Promise((resolve) => setTimeout(resolve, 350)); // nova janela
      const closed = client.closed();
      for (let i = 0; i < 4; i++) client.send(subscribe);

      expect((await closed).code).toBe(1008);
    } finally {
      await limited.close();
    }
  });
});

describe("heartbeat", () => {
  it("terminates connections that stop answering pings, and keeps healthy ones", async () => {
    const fast = await startTestServer({}, { heartbeatIntervalMs: 50 });
    try {
      const healthy = await connect(undefined, fast);
      const zombie = await connect({ autoPong: false }, fast); // finge que a rede caiu
      const zombieClosed = zombie.closed();

      // terminate() não faz handshake de fechamento: o cliente vê 1006 (abnormal closure)
      expect((await zombieClosed).code).toBe(1006);
      expect(healthy.ws.readyState).toBe(WebSocket.OPEN);
    } finally {
      await fast.close();
    }
  });
});
