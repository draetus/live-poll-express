import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  CreatePollResponse,
  PollSummary,
  PollView,
} from "../../../shared/api.js";
import { postJson, startTestServer, type TestServer } from "../helpers/test-server.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function createPoll(question = "Best day?", options = ["Saturday", "Sunday"]) {
  const res = await postJson(`${server.baseUrl}/polls`, { question, options });
  expect(res.status).toBe(201);
  return (await res.json()) as CreatePollResponse;
}

function vote(pollId: string, optionId: string, voterId: string = crypto.randomUUID()) {
  return postJson(`${server.baseUrl}/polls/${pollId}/votes`, { optionId, voterId });
}

function close(pollId: string, token?: string) {
  return postJson(
    `${server.baseUrl}/polls/${pollId}/close`,
    {},
    token === undefined ? {} : { "X-Admin-Token": token },
  );
}

async function expectError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as ApiErrorBody;
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body;
}

describe("create and read", () => {
  it("creates a poll (201) and reads it back without the admin token", async () => {
    const created = await createPoll();

    const res = await fetch(`${server.baseUrl}/polls/${created.poll.id}`);
    const poll = (await res.json()) as PollView;

    expect(res.status).toBe(200);
    expect(poll).toEqual(created.poll);
    expect(JSON.stringify(poll)).not.toContain(created.adminToken);
  });

  it("lists only the seed polls, never the created ones", async () => {
    const created = await createPoll("Not featured?");

    const res = await fetch(`${server.baseUrl}/polls`);
    const list = (await res.json()) as PollSummary[];

    expect(res.status).toBe(200);
    expect(list.map((p) => p.id)).toEqual(["seedTabs", "seedLang", "seedCafe"]);
    expect(list.map((p) => p.id)).not.toContain(created.poll.id);
  });

  it("returns 404 POLL_NOT_FOUND for unknown and malformed ids", async () => {
    await expectError(await fetch(`${server.baseUrl}/polls/zzzzzzzz`), 404, "POLL_NOT_FOUND");
    await expectError(await fetch(`${server.baseUrl}/polls/not-an-id!`), 404, "POLL_NOT_FOUND");
  });
});

describe("validation and malformed requests", () => {
  it("returns 400 VALIDATION_ERROR with details per field", async () => {
    const res = await postJson(`${server.baseUrl}/polls`, { question: "Hi", options: ["Only"] });

    const body = await expectError(res, 400, "VALIDATION_ERROR");
    expect(body.error.details?.map((d) => d.path).sort()).toEqual(["options", "question"]);
  });

  it("returns 400 VALIDATION_ERROR when there is no JSON body at all", async () => {
    const res = await fetch(`${server.baseUrl}/polls`, { method: "POST" });

    await expectError(res, 400, "VALIDATION_ERROR");
  });

  it("returns 400 INVALID_JSON for a broken JSON body", async () => {
    const res = await fetch(`${server.baseUrl}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"question": "oops"',
    });

    await expectError(res, 400, "INVALID_JSON");
  });

  it("returns 413 PAYLOAD_TOO_LARGE for a body over 10 KB", async () => {
    const res = await postJson(`${server.baseUrl}/polls`, { question: "x".repeat(11_000) });

    await expectError(res, 413, "PAYLOAD_TOO_LARGE");
  });

  it("returns 404 NOT_FOUND as JSON for an unknown route", async () => {
    await expectError(await fetch(`${server.baseUrl}/nothing-here`), 404, "NOT_FOUND");
  });
});

describe("voting", () => {
  it("counts a vote and returns the updated poll", async () => {
    const { poll } = await createPoll();

    const res = await vote(poll.id, "2");
    const updated = (await res.json()) as PollView;

    expect(res.status).toBe(200);
    expect(updated.options[1].votes).toBe(1);
    expect(updated.totalVotes).toBe(1);
  });

  it("returns 409 ALREADY_VOTED for the same voter", async () => {
    const { poll } = await createPoll();
    const voterId = crypto.randomUUID();
    await vote(poll.id, "1", voterId);

    await expectError(await vote(poll.id, "2", voterId), 409, "ALREADY_VOTED");
  });

  it("returns 400 INVALID_OPTION for an option that does not exist", async () => {
    const { poll } = await createPoll();

    await expectError(await vote(poll.id, "42"), 400, "INVALID_OPTION");
  });

  it("works on seed polls too", async () => {
    const res = await vote("seedTabs", "1");

    expect(res.status).toBe(200);
  });
});

describe("closing", () => {
  it("returns 403 FORBIDDEN without the token or with a wrong one", async () => {
    const { poll } = await createPoll();

    await expectError(await close(poll.id), 403, "FORBIDDEN");
    await expectError(await close(poll.id, "wrong"), 403, "FORBIDDEN");
  });

  it("closes with the right token, and then votes return 409 POLL_CLOSED", async () => {
    const { poll, adminToken } = await createPoll();

    const res = await close(poll.id, adminToken);
    expect(res.status).toBe(200);
    expect(((await res.json()) as PollView).closed).toBe(true);

    await expectError(await vote(poll.id, "1"), 409, "POLL_CLOSED");
  });
});
