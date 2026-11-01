import { describe, expect, it } from "vitest";
import {
  generateAdminToken,
  ID_ALPHABET,
  POLL_ID_PATTERN,
  shortId,
  tokensMatch,
} from "../../src/lib/ids.js";

describe("shortId", () => {
  it("has 8 characters by default and accepts a custom size", () => {
    expect(shortId()).toHaveLength(8);
    expect(shortId(4)).toHaveLength(4);
  });

  it("only uses the unambiguous alphabet", () => {
    const sample = Array.from({ length: 200 }, () => shortId()).join("");

    for (const char of sample) expect(ID_ALPHABET).toContain(char);
    expect(sample).not.toMatch(/[01OolI]/);
  });

  it("generates ids accepted by POLL_ID_PATTERN", () => {
    for (let i = 0; i < 50; i++) expect(shortId()).toMatch(POLL_ID_PATTERN);
  });
});

describe("POLL_ID_PATTERN", () => {
  it.each(["short", "toolongid", "abc-defg", "0000AAAA", "abcdefg!"])("rejects %s", (id) => {
    expect(POLL_ID_PATTERN.test(id)).toBe(false);
  });
});

describe("generateAdminToken", () => {
  it("is URL-safe and different every time", () => {
    const a = generateAdminToken();
    const b = generateAdminToken();

    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/); // 24 bytes em base64url = 32 caracteres
    expect(a).not.toBe(b);
  });
});

describe("tokensMatch", () => {
  it("accepts the same token", () => {
    expect(tokensMatch("secret-token", "secret-token")).toBe(true);
  });

  it.each([
    ["a different token", "secret-tokeX"],
    ["a token with another length", "secret"],
    ["an empty token", ""],
    ["no token", undefined],
  ])("rejects %s", (_label, received) => {
    expect(tokensMatch("secret-token", received)).toBe(false);
  });
});
