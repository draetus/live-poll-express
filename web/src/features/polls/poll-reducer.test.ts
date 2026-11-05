import { describe, expect, it } from "vitest";
import { makePollView } from "../../test/mock-api";
import { initialPollState, pollReducer } from "./poll-reducer";

describe("pollReducer", () => {
  it("starts loading", () => {
    expect(initialPollState).toEqual({ status: "loading" });
  });

  it("becomes ready when the poll is loaded", () => {
    const poll = makePollView();

    expect(pollReducer(initialPollState, { type: "loaded", poll })).toEqual({
      status: "ready",
      poll,
    });
  });

  it("replaces the poll when a newer one arrives (e.g. after voting)", () => {
    const before = pollReducer(initialPollState, { type: "loaded", poll: makePollView() });
    const after = makePollView({ totalVotes: 1 });

    expect(pollReducer(before, { type: "loaded", poll: after })).toEqual({
      status: "ready",
      poll: after,
    });
  });

  it("goes to not-found", () => {
    expect(pollReducer(initialPollState, { type: "notFound" })).toEqual({ status: "not-found" });
  });

  it("shows an error while loading", () => {
    expect(pollReducer(initialPollState, { type: "failed", message: "Oops" })).toEqual({
      status: "error",
      message: "Oops",
    });
  });

  it("keeps the poll on screen if a reload fails", () => {
    const ready = pollReducer(initialPollState, { type: "loaded", poll: makePollView() });

    expect(pollReducer(ready, { type: "failed", message: "Oops" })).toBe(ready);
  });
});
