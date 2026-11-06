import { describe, expect, it } from "vitest";
import { makePollView } from "../../test/mock-api";
import {
  actionFromServer,
  initialPollState,
  type PollAction,
  type PollState,
  pollReducer,
} from "./poll-reducer";

const poll = makePollView(); // id "pollAbc2", opções "1" e "2", 0 votos

function reduce(...actions: PollAction[]): PollState {
  return actions.reduce(pollReducer, initialPollState);
}

function readyPoll(state: PollState) {
  if (state.status !== "ready") throw new Error(`Expected ready, got ${state.status}`);
  return state;
}

describe("REST actions", () => {
  it("starts loading and becomes ready when the poll is loaded", () => {
    expect(initialPollState).toEqual({ status: "loading", connection: "idle" });
    expect(reduce({ type: "loaded", poll })).toEqual({
      status: "ready",
      poll,
      viewers: null,
      ended: null,
      connection: "idle",
    });
  });

  it("goes to not-found or error", () => {
    expect(reduce({ type: "notFound" }).status).toBe("not-found");
    expect(reduce({ type: "failed", message: "Oops" })).toMatchObject({
      status: "error",
      message: "Oops",
    });
  });

  it("keeps the poll on screen if a reload fails", () => {
    const ready = reduce({ type: "loaded", poll });

    expect(pollReducer(ready, { type: "failed", message: "Oops" })).toBe(ready);
  });

  it("applies the vote response", () => {
    const voted = makePollView({ totalVotes: 1 });

    expect(
      readyPoll(reduce({ type: "loaded", poll }, { type: "received", poll: voted })).poll,
    ).toEqual(voted);
  });

  it("ignores a vote response that is older than what is on screen", () => {
    const state = reduce(
      { type: "loaded", poll },
      { type: "updated", pollId: poll.id, totals: { "1": 1, "2": 1 }, totalVotes: 2 },
      { type: "received", poll: makePollView({ totalVotes: 1 }) }, // chegou atrasada
    );

    expect(readyPoll(state).poll.totalVotes).toBe(2);
  });
});

describe("WebSocket actions", () => {
  const loaded = reduce({ type: "loaded", poll });

  it("applies the totals of poll:updated", () => {
    const state = pollReducer(loaded, {
      type: "updated",
      pollId: poll.id,
      totals: { "1": 3, "2": 1 },
      totalVotes: 4,
    });

    expect(readyPoll(state).poll.options.map((o) => o.votes)).toEqual([3, 1]);
    expect(readyPoll(state).poll.totalVotes).toBe(4);
  });

  it("ignores updates about another poll", () => {
    const action: PollAction = {
      type: "updated",
      pollId: "otherPo2",
      totals: { "1": 9 },
      totalVotes: 9,
    };

    expect(pollReducer(loaded, action)).toBe(loaded);
  });

  it("ignores an update older than the current state", () => {
    const newer = pollReducer(loaded, {
      type: "updated",
      pollId: poll.id,
      totals: { "1": 2, "2": 0 },
      totalVotes: 2,
    });

    const after = pollReducer(newer, {
      type: "updated",
      pollId: poll.id,
      totals: { "1": 1, "2": 0 },
      totalVotes: 1,
    });

    expect(after).toBe(newer);
  });

  it("lets a snapshot replace everything, even with fewer votes (server restarted)", () => {
    const withVotes = pollReducer(loaded, {
      type: "updated",
      pollId: poll.id,
      totals: { "1": 5, "2": 0 },
      totalVotes: 5,
    });

    const state = pollReducer(withVotes, { type: "snapshot", poll });

    expect(readyPoll(state).poll.totalVotes).toBe(0);
  });

  it("keeps the viewers count when a snapshot arrives", () => {
    const state = reduce(
      { type: "loaded", poll },
      { type: "viewers", pollId: poll.id, count: 3 },
      { type: "snapshot", poll },
    );

    expect(readyPoll(state).viewers).toBe(3);
  });

  it("marks the poll closed, and never reopens it", () => {
    const closed = pollReducer(loaded, { type: "closed", pollId: poll.id });
    const afterOldVote = pollReducer(closed, {
      type: "received",
      poll: makePollView({ totalVotes: 1 }),
    });

    expect(readyPoll(closed).poll.closed).toBe(true);
    expect(readyPoll(afterOldVote).poll.closed).toBe(true);
  });

  it("records why the poll ended", () => {
    expect(readyPoll(pollReducer(loaded, { type: "removed", pollId: poll.id })).ended).toBe(
      "removed",
    );
    expect(readyPoll(pollReducer(loaded, { type: "expired" })).ended).toBe("server-restarted");
  });

  it("ignores 'expired' while still loading (the GET will answer 404)", () => {
    expect(pollReducer(initialPollState, { type: "expired" })).toBe(initialPollState);
  });

  it("tracks the connection state in every status", () => {
    expect(pollReducer(initialPollState, { type: "connection", state: "open" }).connection).toBe(
      "open",
    );
    expect(pollReducer(loaded, { type: "connection", state: "reconnecting" }).connection).toBe(
      "reconnecting",
    );
  });
});

describe("actionFromServer", () => {
  it("maps each server message to a reducer action", () => {
    expect(actionFromServer({ type: "poll:snapshot", poll })).toEqual({ type: "snapshot", poll });
    expect(actionFromServer({ type: "poll:closed", pollId: "p" })).toEqual({
      type: "closed",
      pollId: "p",
    });
    expect(actionFromServer({ type: "viewers", pollId: "p", count: 2 })).toEqual({
      type: "viewers",
      pollId: "p",
      count: 2,
    });
  });

  it("turns POLL_NOT_FOUND into 'expired' and ignores other errors", () => {
    expect(actionFromServer({ type: "error", code: "POLL_NOT_FOUND", message: "x" })).toEqual({
      type: "expired",
    });
    expect(actionFromServer({ type: "error", code: "RATE_LIMITED", message: "x" })).toBeNull();
  });
});
