import { describe, expect, it } from "vitest";
import { parseSeed } from "../../src/data/seed.js";
import seedData from "../../src/data/seed.json" with { type: "json" };

const now = new Date("2026-01-01T00:00:00.000Z");

describe("parseSeed", () => {
  it("accepts the real seed.json shipped with the app", () => {
    const polls = parseSeed(seedData, now);

    expect(polls.length).toBeGreaterThan(0);
    for (const poll of polls) {
      expect(poll.isSeed).toBe(true);
      expect(poll.closed).toBe(false);
      expect(poll.createdAt).toBe(now);
    }
  });

  it("turns option texts into numbered options", () => {
    const [poll] = parseSeed(
      [{ id: "seedTest", question: "Yes or no?", options: ["Yes", "No"] }],
      now,
    );

    expect(poll.options).toEqual([
      { id: "1", text: "Yes", votes: 0 },
      { id: "2", text: "No", votes: 0 },
    ]);
  });

  it.each([
    ["an id outside the alphabet", [{ id: "seed0001", question: "Valid?", options: ["A", "B"] }]],
    ["a poll with one option", [{ id: "seedTest", question: "Valid?", options: ["A"] }]],
    [
      "duplicated ids",
      [
        { id: "seedTest", question: "First?", options: ["A", "B"] },
        { id: "seedTest", question: "Second?", options: ["A", "B"] },
      ],
    ],
    ["something that is not an array", { id: "seedTest" }],
  ])("rejects %s", (_label, raw) => {
    expect(() => parseSeed(raw, now)).toThrow(/Invalid seed data/);
  });
});
