import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { json, makePollView, mockApi } from "../test/mock-api";
import { renderApp } from "../test/render-app";
import { HEALTH_CHECK } from "./ServerStatusProvider";

// Timers falsos: 90 s de cold start passam em milissegundos, e o teste decide quando.
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Avança o relógio falso e deixa as promises pendentes (fetch mockado) resolverem. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const networkError = () => Promise.reject(new TypeError("Failed to fetch"));

/** O /health falha nas primeiras `failures` chamadas, depois responde ok. */
function healthAfter(failures: number) {
  let calls = 0;
  return () => (++calls > failures ? json({ status: "ok" }) : networkError());
}

const homeRoutes = { "GET /polls": () => json([]) };

describe("cold start", () => {
  it("shows nothing special when the server answers right away", async () => {
    mockApi({ "GET /health": healthAfter(0), ...homeRoutes });
    renderApp("/", { checkServer: true });
    await advance(0);

    expect(screen.queryByText(/Starting the server/)).toBeNull();
    expect(screen.getByRole("button", { name: "Create poll" })).toHaveProperty("disabled", false);
  });

  it("explains the wait and blocks the form while the server wakes up", async () => {
    // Falha 3 vezes: tentativas em 0 s, 3 s e 6 s; a 4ª (9 s) responde.
    mockApi({ "GET /health": healthAfter(3), ...homeRoutes });
    renderApp("/", { checkServer: true });
    await advance(0);

    expect(screen.getByText(/Starting the server \(free tier\)/)).toBeDefined();
    const waiting = screen.getByRole("button", { name: "Waiting for the server…" });
    expect(waiting).toHaveProperty("disabled", true);

    await advance(3 * HEALTH_CHECK.retryEveryMs);

    expect(screen.queryByText(/Starting the server/)).toBeNull();
    expect(screen.getByRole("button", { name: "Create poll" })).toHaveProperty("disabled", false);
  });

  it("shows the notice if the first answer is slow, before it fails", async () => {
    let answer: (response: Response) => void = () => {};
    mockApi({
      "GET /health": () => new Promise<Response>((resolve) => (answer = resolve)),
      ...homeRoutes,
    });
    renderApp("/", { checkServer: true });

    await advance(HEALTH_CHECK.slowAfterMs - 1);
    expect(screen.queryByText(/Starting the server/)).toBeNull(); // rápido: nada pisca na tela

    await advance(1);
    expect(screen.getByText(/Starting the server/)).toBeDefined();

    await act(async () => answer(json({ status: "ok" })));
    expect(screen.queryByText(/Starting the server/)).toBeNull();
  });

  it("gives up after ~90 s and lets the visitor try again", async () => {
    const health = vi.fn((): Promise<Response> => networkError());
    mockApi({ "GET /health": () => health(), ...homeRoutes });
    renderApp("/", { checkServer: true });

    await advance(HEALTH_CHECK.giveUpAfterMs);

    expect(screen.getByRole("alert").textContent).toMatch(/not responding/);
    const callsWhenGaveUp = health.mock.calls.length;
    await advance(60_000);
    expect(health.mock.calls.length).toBe(callsWhenGaveUp); // parou de tentar

    health.mockImplementation(() => Promise.resolve(json({ status: "ok" })));
    // fireEvent, e não userEvent: com os timers falsos do Vitest, o userEvent trava
    // esperando timers internos que nunca avançam. O clique simples basta aqui.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance(0);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Create poll" })).toHaveProperty("disabled", false);
  });

  it("waits for the server before loading the poll and opening the WebSocket", async () => {
    const fetchMock = mockApi({
      "GET /health": healthAfter(1),
      "GET /polls/pollAbc2": () => json(makePollView()),
    });
    const app = renderApp("/p/pollAbc2", { checkServer: true });
    await advance(0);

    expect(screen.getByText("Loading poll…")).toBeDefined();
    expect(app.sockets.sockets).toHaveLength(0);
    const pollRequests = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/polls/pollAbc2"));
    expect(pollRequests()).toHaveLength(0);

    await advance(HEALTH_CHECK.retryEveryMs);

    expect(screen.getByRole("heading", { name: "Best day?" })).toBeDefined();
    expect(pollRequests()).toHaveLength(1);
    expect(app.sockets.sockets).toHaveLength(1);
  });
});
