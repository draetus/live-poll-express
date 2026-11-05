import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../../src/ws/protocol.js";

describe("parseClientMessage", () => {
  it.each([
    [{ type: "subscribe", pollId: "seedTabs" }],
    [{ type: "unsubscribe", pollId: "seedTabs" }],
  ])("accepts %j", (message) => {
    expect(parseClientMessage(JSON.stringify(message), false)).toEqual({ ok: true, message });
  });

  it("drops unknown extra fields", () => {
    const result = parseClientMessage('{"type":"subscribe","pollId":"seedTabs","x":1}', false);

    expect(result).toEqual({ ok: true, message: { type: "subscribe", pollId: "seedTabs" } });
  });

  it("rejects binary frames", () => {
    expect(parseClientMessage('{"type":"subscribe","pollId":"seedTabs"}', true)).toEqual({
      ok: false,
      reason: "Binary messages are not supported",
    });
  });

  it("rejects text that is not JSON", () => {
    expect(parseClientMessage("hello", false)).toEqual({
      ok: false,
      reason: "Message is not valid JSON",
    });
  });

  it.each([
    ["an unknown type", '{"type":"vote","pollId":"seedTabs"}'],
    ["a missing pollId", '{"type":"subscribe"}'],
    ["an empty pollId", '{"type":"subscribe","pollId":""}'],
    ["a pollId that is not a string", '{"type":"subscribe","pollId":42}'],
    ["a JSON array", "[]"],
    ["JSON null", "null"],
  ])("rejects %s", (_label, text) => {
    expect(parseClientMessage(text, false).ok).toBe(false);
  });
});
