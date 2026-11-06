import type { ServerMessage } from "@shared/ws";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSocketFactory } from "../test/fake-websocket";
import { type ConnectionState, RealtimeClient } from "./realtime-client";

let factory: ReturnType<typeof fakeSocketFactory>;
let client: RealtimeClient;
let states: ConnectionState[];

function makeClient(random = () => 1) {
  client = new RealtimeClient({ url: "ws://test/ws", createSocket: factory.createSocket, random });
  states = [];
  client.onStateChange((state) => states.push(state));
  return client;
}

beforeEach(() => {
  // Fake timers: setTimeout não espera de verdade; o teste "avança o relógio".
  vi.useFakeTimers();
  factory = fakeSocketFactory();
  makeClient();
});

afterEach(() => {
  client.stop();
  vi.useRealTimers();
});

describe("connecting and subscribing", () => {
  it("does not connect until something is subscribed", () => {
    client.start();

    expect(factory.sockets).toHaveLength(0);
    expect(client.getState()).toBe("idle");
  });

  it("connects on subscribe and sends the subscription once the socket opens", () => {
    client.start();
    client.subscribe("pollA");

    expect(client.getState()).toBe("connecting");
    expect(factory.latest().url).toBe("ws://test/ws");

    factory.latest().open();

    expect(client.getState()).toBe("open");
    expect(factory.latest().sent).toEqual([{ type: "subscribe", pollId: "pollA" }]);
  });

  it("sends subscribe and unsubscribe right away while open", () => {
    client.start();
    client.subscribe("pollA");
    factory.latest().open();

    client.unsubscribe("pollA");
    client.subscribe("pollB");

    expect(factory.latest().sent).toEqual([
      { type: "subscribe", pollId: "pollA" },
      { type: "unsubscribe", pollId: "pollA" },
      { type: "subscribe", pollId: "pollB" },
    ]);
  });

  it("ignores unsubscribe for a poll that is not the current one", () => {
    client.start();
    client.subscribe("pollB");
    factory.latest().open();

    client.unsubscribe("pollA"); // ex.: cleanup atrasado da página anterior

    expect(factory.latest().sent).toEqual([{ type: "subscribe", pollId: "pollB" }]);
  });

  it("remembers a subscription made before start()", () => {
    client.subscribe("pollA");
    expect(factory.sockets).toHaveLength(0);

    client.start();

    expect(factory.sockets).toHaveLength(1);
  });
});

describe("messages", () => {
  it("delivers parsed server messages to listeners until they unsubscribe", () => {
    const received: ServerMessage[] = [];
    const stop = client.onMessage((m) => received.push(m));
    client.start();
    client.subscribe("pollA");
    factory.latest().open();

    factory.latest().receive({ type: "viewers", pollId: "pollA", count: 2 });
    stop();
    factory.latest().receive({ type: "viewers", pollId: "pollA", count: 3 });

    expect(received).toEqual([{ type: "viewers", pollId: "pollA", count: 2 }]);
  });

  it("ignores frames that are not valid JSON", () => {
    const listener = vi.fn();
    client.onMessage(listener);
    client.start();
    client.subscribe("pollA");
    factory.latest().open();

    factory.latest().onmessage?.(new MessageEvent("message", { data: "not json" }));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("reconnection", () => {
  function connected() {
    client.start();
    client.subscribe("pollA");
    factory.latest().open();
  }

  it("reconnects with exponential backoff capped at 15 s", () => {
    connected();
    const delays: number[] = [];

    for (let i = 0; i < 7; i++) {
      const before = factory.sockets.length;
      factory.latest().drop();
      const start = Date.now();
      vi.advanceTimersToNextTimer(); // pula para o próximo setTimeout pendente
      delays.push(Date.now() - start);
      expect(factory.sockets).toHaveLength(before + 1);
    }

    // random = 1 → atraso = intervalo cheio: 0,5 s, 1 s, 2 s, 4 s, 8 s, 15 s, 15 s
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 15_000, 15_000]);
  });

  it("adds jitter: with random = 0 the delay is half the interval", () => {
    makeClient(() => 0);
    connected();
    factory.latest().drop();

    vi.advanceTimersByTime(249);
    expect(factory.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(factory.sockets).toHaveLength(2);
  });

  it("re-subscribes to the same poll after reconnecting", () => {
    connected();
    factory.latest().drop();
    expect(client.getState()).toBe("reconnecting");

    vi.advanceTimersToNextTimer();
    factory.latest().open();

    expect(client.getState()).toBe("open");
    expect(factory.latest().sent).toEqual([{ type: "subscribe", pollId: "pollA" }]);
  });

  it("resets the backoff after a successful connection", () => {
    connected();
    factory.latest().drop();
    vi.advanceTimersByTime(500);
    factory.latest().drop(); // caiu antes de abrir: próxima espera é 1 s
    vi.advanceTimersByTime(1000);
    factory.latest().open(); // conectou: zera

    factory.latest().drop();
    vi.advanceTimersByTime(499);
    expect(factory.sockets).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(factory.sockets).toHaveLength(4);
  });

  it("does not reconnect after a policy violation (1008)", () => {
    connected();

    factory.latest().drop(1008);
    vi.advanceTimersByTime(60_000);

    expect(factory.sockets).toHaveLength(1);
    expect(client.getState()).toBe("idle");
  });

  it("reconnects immediately when the browser goes back online", () => {
    connected();
    factory.latest().drop();
    factory.latest().drop(); // não muda nada: o socket já caiu

    window.dispatchEvent(new Event("online"));

    expect(factory.sockets).toHaveLength(2);
  });

  it("reports the states it goes through", () => {
    connected();
    factory.latest().drop();
    vi.advanceTimersToNextTimer();
    factory.latest().open();

    expect(states).toEqual(["connecting", "open", "reconnecting", "open"]);
  });
});

describe("stop", () => {
  it("closes the socket and cancels any pending reconnection", () => {
    client.start();
    client.subscribe("pollA");
    factory.latest().open();
    factory.latest().drop();

    client.stop();
    vi.advanceTimersByTime(60_000);

    expect(factory.sockets).toHaveLength(1);
    expect(client.getState()).toBe("idle");
  });

  it("can be started again, keeping the subscription (StrictMode does this)", () => {
    client.start();
    client.subscribe("pollA");
    client.stop();
    expect(factory.sockets[0].closedByClient).toBe(true);

    client.start();
    factory.latest().open();

    expect(factory.sockets).toHaveLength(2);
    expect(factory.latest().sent).toEqual([{ type: "subscribe", pollId: "pollA" }]);
  });

  it("ignores the late 'close' event of the old socket after a restart", () => {
    client.start();
    client.subscribe("pollA");
    factory.latest().open();
    client.stop();
    client.start();
    factory.latest().open();

    vi.advanceTimersByTime(60_000); // o "close" atrasado do socket antigo chega aqui

    expect(factory.sockets).toHaveLength(2); // nenhuma reconexão extra
    expect(client.getState()).toBe("open");
  });
});
