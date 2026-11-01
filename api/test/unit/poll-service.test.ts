import { beforeEach, describe, expect, it } from "vitest";
import {
  AlreadyVotedError,
  ForbiddenError,
  InvalidOptionError,
  PollClosedError,
  PollNotFoundError,
} from "../../src/domain/errors.js";
import { InMemoryPollRepository } from "../../src/repositories/poll-repository.js";
import { PollService } from "../../src/services/poll-service.js";
import { FakeNotifier, makePoll } from "../helpers/fakes.js";

const VOTER_A = "6f1c2b9e-1d4f-4a5b-9c8d-7e6f5a4b3c2d";
const VOTER_B = "0a9b8c7d-6e5f-4a3b-8c1d-2e3f4a5b6c7d";

let repo: InMemoryPollRepository;
let notifier: FakeNotifier;
let service: PollService;

// beforeEach: cada teste começa com repositório e notifier NOVOS (testes isolados).
beforeEach(() => {
  repo = new InMemoryPollRepository({ maxPolls: 10 });
  notifier = new FakeNotifier();
  service = new PollService(repo, notifier, {
    now: () => new Date("2026-05-01T10:00:00.000Z"),
  });
});

function createSamplePoll() {
  return service.create({ question: "Best day?", options: ["Saturday", "Sunday"] });
}

describe("create", () => {
  it("creates an open poll with zero votes and returns the admin token once", () => {
    const { poll, adminToken } = createSamplePoll();

    expect(poll).toEqual({
      id: expect.any(String),
      question: "Best day?",
      options: [
        { id: "1", text: "Saturday", votes: 0 },
        { id: "2", text: "Sunday", votes: 0 },
      ],
      totalVotes: 0,
      closed: false,
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    expect(adminToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(repo.has(poll.id)).toBe(true);
  });

  it("retries the id generator on collision", () => {
    repo.insert(makePoll({ id: "takenId1" }));
    const ids = ["takenId1", "takenId1", "freeId23"];
    service = new PollService(repo, notifier, { generateId: () => ids.shift() ?? "unused" });

    expect(createSamplePoll().poll.id).toBe("freeId23");
  });

  it("notifies pollRemoved for polls evicted by the memory limit", () => {
    repo = new InMemoryPollRepository({ maxPolls: 1 });
    service = new PollService(repo, notifier);
    const first = createSamplePoll();

    createSamplePoll();

    expect(notifier.calls).toEqual([{ event: "removed", pollId: first.poll.id }]);
  });
});

describe("get and listFeatured", () => {
  it("throws PollNotFoundError for an unknown id", () => {
    expect(() => service.get("missing1")).toThrow(PollNotFoundError);
  });

  it("lists only seed polls", () => {
    repo.insert(makePoll({ id: "seedTabs", isSeed: true }));
    createSamplePoll();

    expect(service.listFeatured().map((p) => p.id)).toEqual(["seedTabs"]);
  });
});

describe("vote", () => {
  it("counts the vote, returns the new state and notifies", () => {
    const { poll } = createSamplePoll();

    const view = service.vote(poll.id, { optionId: "2", voterId: VOTER_A });

    expect(view.options[1].votes).toBe(1);
    expect(view.totalVotes).toBe(1);
    expect(notifier.calls).toEqual([{ event: "updated", pollId: poll.id }]);
  });

  it("lets different voters vote", () => {
    const { poll } = createSamplePoll();
    service.vote(poll.id, { optionId: "1", voterId: VOTER_A });

    const view = service.vote(poll.id, { optionId: "1", voterId: VOTER_B });

    expect(view.options[0].votes).toBe(2);
  });

  it("rejects a second vote from the same voter, even for another option", () => {
    const { poll } = createSamplePoll();
    service.vote(poll.id, { optionId: "1", voterId: VOTER_A });

    expect(() => service.vote(poll.id, { optionId: "2", voterId: VOTER_A })).toThrow(
      AlreadyVotedError,
    );
    expect(service.get(poll.id).totalVotes).toBe(1);
  });

  it("rejects an option that does not exist", () => {
    const { poll } = createSamplePoll();

    expect(() => service.vote(poll.id, { optionId: "9", voterId: VOTER_A })).toThrow(
      InvalidOptionError,
    );
  });

  it("rejects votes on a closed poll", () => {
    const { poll, adminToken } = createSamplePoll();
    service.close(poll.id, adminToken);

    expect(() => service.vote(poll.id, { optionId: "1", voterId: VOTER_A })).toThrow(
      PollClosedError,
    );
  });

  it("rejects votes on an unknown poll", () => {
    expect(() => service.vote("missing1", { optionId: "1", voterId: VOTER_A })).toThrow(
      PollNotFoundError,
    );
  });

  it("does not notify when the vote is rejected", () => {
    const { poll } = createSamplePoll();

    expect(() => service.vote(poll.id, { optionId: "9", voterId: VOTER_A })).toThrow();
    expect(notifier.calls).toEqual([]);
  });
});

describe("close", () => {
  it("closes the poll with the right token and notifies", () => {
    const { poll, adminToken } = createSamplePoll();

    const view = service.close(poll.id, adminToken);

    expect(view.closed).toBe(true);
    expect(notifier.calls).toEqual([{ event: "closed", pollId: poll.id }]);
  });

  it("is idempotent: closing twice works but notifies only once", () => {
    const { poll, adminToken } = createSamplePoll();
    service.close(poll.id, adminToken);

    expect(service.close(poll.id, adminToken).closed).toBe(true);
    expect(notifier.calls).toHaveLength(1);
  });

  it.each([
    ["a wrong token", "wrong-token"],
    ["no token", undefined],
  ])("rejects %s with ForbiddenError", (_label, token) => {
    const { poll } = createSamplePoll();

    expect(() => service.close(poll.id, token)).toThrow(ForbiddenError);
    expect(service.get(poll.id).closed).toBe(false);
  });
});
