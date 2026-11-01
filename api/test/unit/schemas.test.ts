import { describe, expect, it } from "vitest";
import { LIMITS } from "../../../shared/limits.js";
import { createPollSchema, pollIdSchema, voteSchema } from "../../src/http/schemas.js";

const valid = { question: "Best day?", options: ["Saturday", "Sunday"] };

describe("createPollSchema", () => {
  it("accepts a valid poll and trims the texts", () => {
    const parsed = createPollSchema.parse({ question: "  Best day?  ", options: [" Sat ", "Sun"] });

    expect(parsed).toEqual({ question: "Best day?", options: ["Sat", "Sun"] });
  });

  it("accepts the exact limits", () => {
    const options = Array.from({ length: LIMITS.OPTIONS_MAX }, (_, i) => `${"x".repeat(79)}${i}`);
    const input = { question: "q".repeat(LIMITS.QUESTION_MAX), options };

    expect(createPollSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["question too short", { ...valid, question: "Hi" }],
    ["question only spaces", { ...valid, question: "     " }],
    ["question too long", { ...valid, question: "q".repeat(LIMITS.QUESTION_MAX + 1) }],
    ["only one option", { ...valid, options: ["Alone"] }],
    ["too many options", { ...valid, options: ["1", "2", "3", "4", "5", "6", "7"] }],
    ["empty option after trim", { ...valid, options: ["Yes", "   "] }],
    ["option too long", { ...valid, options: ["Yes", "x".repeat(LIMITS.OPTION_TEXT_MAX + 1)] }],
    ["duplicated options ignoring case and spaces", { ...valid, options: ["Yes", " yes "] }],
    ["options is not an array", { ...valid, options: "Yes,No" }],
    ["missing body", undefined],
  ])("rejects %s", (_label, input) => {
    expect(createPollSchema.safeParse(input).success).toBe(false);
  });
});

describe("voteSchema", () => {
  it("accepts an option id and a UUID", () => {
    const input = { optionId: "1", voterId: crypto.randomUUID() };

    expect(voteSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["voterId not a UUID", { optionId: "1", voterId: "me" }],
    ["empty optionId", { optionId: "", voterId: crypto.randomUUID() }],
    ["optionId too long", { optionId: "x".repeat(17), voterId: crypto.randomUUID() }],
  ])("rejects %s", (_label, input) => {
    expect(voteSchema.safeParse(input).success).toBe(false);
  });
});

describe("pollIdSchema", () => {
  it("accepts generated-looking ids and rejects others", () => {
    expect(pollIdSchema.safeParse("seedTabs").success).toBe(true);
    expect(pollIdSchema.safeParse("../etc").success).toBe(false);
  });
});
