import { describe, expect, it } from "vitest";
import { clientKey, FixedWindowLimiter } from "../../src/http/middlewares/rate-limit.js";

// Relógio controlado à mão: o teste decide quanto tempo "passou".
function fakeClock(start = 1_000_000) {
  let time = start;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
}

describe("FixedWindowLimiter", () => {
  it("allows up to `max` hits per window, then blocks", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowLimiter({ max: 3, windowMs: 60_000 }, clock.now);

    expect([1, 2, 3].map(() => limiter.hit("a").allowed)).toEqual([true, true, true]);
    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterMs: 60_000 });
  });

  it("tells how long until the window resets", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowLimiter({ max: 1, windowMs: 60_000 }, clock.now);

    limiter.hit("a");
    clock.advance(45_000);

    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterMs: 15_000 });
  });

  it("allows again once the window is over", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowLimiter({ max: 1, windowMs: 60_000 }, clock.now);

    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    clock.advance(60_000);

    expect(limiter.hit("a").allowed).toBe(true);
  });

  it("restarts a key's window even when no sweep happened in between", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowLimiter({ max: 1, windowMs: 60_000 }, clock.now);

    clock.advance(30_000);
    limiter.hit("a"); // janela de "a": de 30 s até 90 s
    clock.advance(31_000);
    limiter.hit("b"); // 61 s: varredura roda (e agenda a próxima para 121 s); "a" segue válida
    clock.advance(29_000); // 90 s: a janela de "a" acabou, mas a próxima varredura é só em 121 s

    expect(limiter.hit("a").allowed).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = new FixedWindowLimiter({ max: 1, windowMs: 60_000 }, fakeClock().now);

    limiter.hit("a");

    expect(limiter.hit("a").allowed).toBe(false);
    expect(limiter.hit("b").allowed).toBe(true);
  });

  it("forgets expired keys, so memory does not grow forever", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowLimiter({ max: 5, windowMs: 60_000 }, clock.now);
    for (let i = 0; i < 100; i++) limiter.hit(`ip-${i}`);
    expect(limiter.size).toBe(100);

    clock.advance(60_000);
    limiter.hit("new-visitor");

    expect(limiter.size).toBe(1);
  });
});

describe("clientKey", () => {
  it("uses the IPv4 address as is, also when written as IPv6", () => {
    expect(clientKey("203.0.113.5")).toBe("203.0.113.5");
    expect(clientKey("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("groups IPv6 addresses by their /64 prefix", () => {
    const a = clientKey("2001:db8:abcd:12:1111:2222:3333:4444");
    const b = clientKey("2001:0db8:abcd:0012::9");

    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(clientKey("2001:db8:abcd:13::1")).not.toBe(a);
  });

  it("expands '::' in the middle of the prefix", () => {
    expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientKey("::1")).toBe("0:0:0:0::/64");
  });

  it("falls back to a fixed key when there is no IP", () => {
    expect(clientKey(undefined)).toBe("unknown");
  });
});
