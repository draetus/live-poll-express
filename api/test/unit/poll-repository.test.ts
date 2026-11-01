import { describe, expect, it } from "vitest";
import { InMemoryPollRepository } from "../../src/repositories/poll-repository.js";
import { makePoll } from "../helpers/fakes.js";

describe("InMemoryPollRepository", () => {
  it("stores and finds polls by id", () => {
    const repo = new InMemoryPollRepository({ maxPolls: 10 });
    const poll = makePoll();

    repo.insert(poll);

    expect(repo.findById(poll.id)).toBe(poll);
    expect(repo.has(poll.id)).toBe(true);
    expect(repo.findById("missing1")).toBeUndefined();
  });

  it("refuses a duplicate id", () => {
    const repo = new InMemoryPollRepository({ maxPolls: 10 });
    const poll = makePoll();
    repo.insert(poll);

    expect(() => repo.insert(makePoll({ id: poll.id }))).toThrow(/Duplicate/);
  });

  it("lists only seed polls, in insertion order", () => {
    const repo = new InMemoryPollRepository({ maxPolls: 10 });
    const seedA = makePoll({ isSeed: true });
    const seedB = makePoll({ isSeed: true });
    repo.insert(seedA);
    repo.insert(makePoll());
    repo.insert(seedB);

    expect(repo.listSeeds()).toEqual([seedA, seedB]);
  });

  it("evicts the oldest user poll when going over maxPolls", () => {
    const repo = new InMemoryPollRepository({ maxPolls: 2 });
    const first = makePoll();
    const second = makePoll();
    const third = makePoll();

    expect(repo.insert(first)).toEqual([]);
    expect(repo.insert(second)).toEqual([]);
    expect(repo.insert(third)).toEqual([first.id]);

    expect(repo.has(first.id)).toBe(false);
    expect(repo.has(second.id)).toBe(true);
    expect(repo.has(third.id)).toBe(true);
  });

  it("never evicts seeds, and seeds do not count toward the limit", () => {
    const repo = new InMemoryPollRepository({ maxPolls: 1 });
    const seed = makePoll({ isSeed: true });
    const userA = makePoll();
    const userB = makePoll();
    repo.insert(seed);
    repo.insert(userA);

    expect(repo.insert(userB)).toEqual([userA.id]);
    expect(repo.has(seed.id)).toBe(true);
    expect(repo.has(userB.id)).toBe(true);
  });
});
