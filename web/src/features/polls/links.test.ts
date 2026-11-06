import { describe, expect, it } from "vitest";
import { adminTokenFromHash, adminUrl, pollUrl } from "./links";

describe("links", () => {
  it("builds the public and the admin link from the current origin", () => {
    const origin = window.location.origin;

    expect(pollUrl("pollAbc2")).toBe(`${origin}/p/pollAbc2`);
    expect(adminUrl("pollAbc2", "tok_en-1")).toBe(`${origin}/p/pollAbc2#admin=tok_en-1`);
  });

  it("reads the admin token from the fragment", () => {
    expect(adminTokenFromHash("#admin=tok_en-1")).toBe("tok_en-1");
    expect(adminTokenFromHash("admin=abc")).toBe("abc");
    expect(adminTokenFromHash("#x=1&admin=abc")).toBe("abc");
  });

  it("ignores a missing, empty or malformed token", () => {
    expect(adminTokenFromHash("")).toBeUndefined();
    expect(adminTokenFromHash("#admin=")).toBeUndefined();
    expect(adminTokenFromHash("#other=abc")).toBeUndefined();
    expect(adminTokenFromHash("#admin=%3Cscript%3E")).toBeUndefined();
    expect(adminTokenFromHash(`#admin=${"a".repeat(129)}`)).toBeUndefined();
  });

  it("round-trips: the token in adminUrl is the one read back", () => {
    const hash = new URL(adminUrl("pollAbc2", "tok_en-1")).hash;

    expect(adminTokenFromHash(hash)).toBe("tok_en-1");
  });
});
