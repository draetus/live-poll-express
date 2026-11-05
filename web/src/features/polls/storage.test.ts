import { describe, expect, it, vi } from "vitest";
import { getAdminToken, getVote, getVoterId, saveAdminToken, saveVote } from "./storage";

describe("voterId", () => {
  it("is a UUID and stays the same across calls", () => {
    const id = getVoterId();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getVoterId()).toBe(id);
  });
});

describe("votes and admin tokens", () => {
  it("saves and reads per poll", () => {
    saveVote("pollA", { optionId: "2" });
    saveVote("pollB", { optionId: null });
    saveAdminToken("pollA", "token-a");

    expect(getVote("pollA")).toEqual({ optionId: "2" });
    expect(getVote("pollB")).toEqual({ optionId: null });
    expect(getVote("pollC")).toBeUndefined();
    expect(getAdminToken("pollA")).toBe("token-a");
    expect(getAdminToken("pollB")).toBeUndefined();
  });

  it("ignores corrupted data instead of crashing", () => {
    localStorage.setItem("live-poll:votes", "{not json");

    expect(getVote("pollA")).toBeUndefined();
  });
});

describe("when localStorage is unavailable", () => {
  it("keeps working without remembering anything", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveVote("pollA", { optionId: "1" })).not.toThrow();
    expect(getVote("pollA")).toBeUndefined();
    expect(getVoterId()).toBe(getVoterId()); // estável ao menos enquanto a aba vive
  });
});
