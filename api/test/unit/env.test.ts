import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env.js";

describe("parseEnv", () => {
  it("applies defaults when variables are missing", () => {
    const env = parseEnv({});

    expect(env).toEqual({
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "info",
      CORS_ORIGINS: ["http://localhost:5173"],
      MAX_POLLS: 500,
      RATE_LIMIT_CREATE_PER_MIN: 5,
      RATE_LIMIT_VOTE_PER_MIN: 30,
      WS_MESSAGES_PER_10S: 20,
    });
  });

  it("reads the limits from the environment", () => {
    const env = parseEnv({ RATE_LIMIT_CREATE_PER_MIN: "2", WS_MESSAGES_PER_10S: "50" });

    expect(env.RATE_LIMIT_CREATE_PER_MIN).toBe(2);
    expect(env.WS_MESSAGES_PER_10S).toBe(50);
    expect(() => parseEnv({ RATE_LIMIT_VOTE_PER_MIN: "0" })).toThrow(/RATE_LIMIT_VOTE_PER_MIN/);
  });

  it("coerces PORT from string to number", () => {
    expect(parseEnv({ PORT: "8080" }).PORT).toBe(8080);
  });

  it("splits, trims and normalizes CORS_ORIGINS", () => {
    const env = parseEnv({
      CORS_ORIGINS: " https://live-poll.vercel.app/ , http://localhost:5173 ",
    });

    expect(env.CORS_ORIGINS).toEqual(["https://live-poll.vercel.app", "http://localhost:5173"]);
  });

  it("accepts production when CORS_ORIGINS is explicitly set", () => {
    const env = parseEnv({ NODE_ENV: "production", CORS_ORIGINS: "https://live-poll.vercel.app" });

    expect(env.CORS_ORIGINS).toEqual(["https://live-poll.vercel.app"]);
  });

  it.each([
    ["PORT not a number", { PORT: "abc" }],
    ["PORT out of range", { PORT: "70000" }],
    ["unknown NODE_ENV", { NODE_ENV: "staging" }],
    ["unknown LOG_LEVEL", { LOG_LEVEL: "verbose" }],
    ["CORS origin is not a URL", { CORS_ORIGINS: "not-a-url" }],
    ["CORS_ORIGINS empty", { CORS_ORIGINS: " , " }],
    ["CORS_ORIGINS missing in production", { NODE_ENV: "production" }],
    ["MAX_POLLS is zero", { MAX_POLLS: "0" }],
  ])("throws when %s", (_label, source) => {
    expect(() => parseEnv(source)).toThrow(/Invalid environment variables/);
  });
});
