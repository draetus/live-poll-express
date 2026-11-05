import { describe, expect, it } from "vitest";
import { MessageLimiter } from "../../src/ws/message-limiter.js";

// Relógio controlado à mão: o teste decide quanto tempo "passou", sem esperar de verdade.
function fakeClock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("MessageLimiter", () => {
  it("allows up to `max` messages per window", () => {
    const clock = fakeClock();
    const limiter = new MessageLimiter({ max: 3, windowMs: 1000 }, clock.now);

    expect([limiter.hit(), limiter.hit(), limiter.hit()]).toEqual(["allow", "allow", "allow"]);
  });

  it("warns once when the limit is exceeded, then drops silently", () => {
    const clock = fakeClock();
    const limiter = new MessageLimiter({ max: 2, windowMs: 1000 }, clock.now);
    limiter.hit();
    limiter.hit();

    expect(limiter.hit()).toBe("warn");
    expect(limiter.hit()).toBe("drop");
    expect(limiter.hit()).toBe("drop");
  });

  it("resets the count when a new window starts", () => {
    const clock = fakeClock();
    const limiter = new MessageLimiter({ max: 1, windowMs: 1000 }, clock.now);
    limiter.hit();
    expect(limiter.hit()).toBe("warn");

    clock.advance(1000);

    expect(limiter.hit()).toBe("allow");
  });

  it("asks to disconnect when the client exceeds the limit again in a later window", () => {
    const clock = fakeClock();
    const limiter = new MessageLimiter({ max: 1, windowMs: 1000 }, clock.now);
    limiter.hit();
    limiter.hit(); // warn (1º strike)

    clock.advance(1000);
    limiter.hit(); // allow

    expect(limiter.hit()).toBe("disconnect");
  });
});
