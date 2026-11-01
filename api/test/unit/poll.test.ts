import { describe, expect, it } from "vitest";
import { buildOptions, toPollSummary, toPollView } from "../../src/domain/poll.js";
import { makePoll } from "../helpers/fakes.js";

describe("buildOptions", () => {
  it("numbers the options from 1 and starts with zero votes", () => {
    expect(buildOptions(["A", "B", "C"])).toEqual([
      { id: "1", text: "A", votes: 0 },
      { id: "2", text: "B", votes: 0 },
      { id: "3", text: "C", votes: 0 },
    ]);
  });
});

describe("toPollView", () => {
  const poll = makePoll({
    options: [
      { id: "1", text: "Yes", votes: 3 },
      { id: "2", text: "No", votes: 2 },
    ],
    voters: new Set(["voter-a", "voter-b"]),
    adminToken: "super-secret",
  });

  it("computes totalVotes and serializes createdAt as ISO 8601", () => {
    const view = toPollView(poll);

    expect(view.totalVotes).toBe(5);
    expect(view.createdAt).toBe("2026-01-01T12:00:00.000Z");
  });

  it("never exposes voters or the admin token", () => {
    const view = toPollView(poll);
    const json = JSON.stringify(view);

    expect(view).not.toHaveProperty("voters");
    expect(view).not.toHaveProperty("adminToken");
    expect(json).not.toContain("super-secret");
    expect(json).not.toContain("voter-a");
  });

  it("returns copies, so changing the view does not change the poll", () => {
    const view = toPollView(poll);
    view.options[0].votes = 999;

    expect(poll.options[0].votes).toBe(3);
  });
});

describe("toPollSummary", () => {
  it("keeps only the fields needed by a listing", () => {
    const summary = toPollSummary(makePoll({ id: "seedTabs", question: "Tabs?" }));

    expect(summary).toEqual({ id: "seedTabs", question: "Tabs?", totalVotes: 0, closed: false });
  });
});
