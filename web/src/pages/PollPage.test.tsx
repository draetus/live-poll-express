import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getAdminToken, getVote, saveAdminToken, saveVote } from "../features/polls/storage";
import { apiError, delayed, json, type MockRoutes, makePollView, mockApi } from "../test/mock-api";
import { renderApp } from "../test/render-app";

const poll = makePollView();
const afterVote = makePollView({
  options: [
    { id: "1", text: "Saturday", votes: 0 },
    { id: "2", text: "Sunday", votes: 1 },
  ],
  totalVotes: 1,
});

describe("PollPage", () => {
  it("loads the poll and lets the visitor vote", async () => {
    const fetchMock = mockApi({
      "GET /polls/pollAbc2": () => json(poll),
      "POST /polls/pollAbc2/votes": () => json(afterVote),
    });
    const user = userEvent.setup();
    renderApp("/p/pollAbc2");

    expect(await screen.findByRole("heading", { name: "Best day?" })).toBeDefined();
    await user.click(screen.getByRole("radio", { name: "Sunday" }));
    await user.click(screen.getByRole("button", { name: "Vote" }));

    expect(await screen.findByText("You voted for “Sunday”.")).toBeDefined();
    expect(screen.getByText("100% · 1")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Vote" })).toBeNull();
    expect(getVote("pollAbc2")).toEqual({ optionId: "2" });

    const voteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(voteCall?.[1]?.body));
    expect(body.optionId).toBe("2");
    expect(body.voterId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("disables the Vote button until an option is chosen", async () => {
    mockApi({ "GET /polls/pollAbc2": () => json(poll) });
    renderApp("/p/pollAbc2");

    expect(await screen.findByRole("button", { name: "Vote" })).toHaveProperty("disabled", true);
  });

  it("shows results directly when this browser already voted", async () => {
    saveVote("pollAbc2", { optionId: "1" });
    mockApi({ "GET /polls/pollAbc2": () => json(poll) });
    renderApp("/p/pollAbc2");

    expect(await screen.findByText("You voted for “Saturday”.")).toBeDefined();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("treats ALREADY_VOTED as 'show the results', not as a failure", async () => {
    mockApi({
      "GET /polls/pollAbc2": () => json(poll),
      "POST /polls/pollAbc2/votes": () => apiError(409, "ALREADY_VOTED"),
    });
    const user = userEvent.setup();
    renderApp("/p/pollAbc2");

    await user.click(await screen.findByRole("radio", { name: "Saturday" }));
    await user.click(screen.getByRole("button", { name: "Vote" }));

    expect(await screen.findByText("You have already voted on this poll.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getVote("pollAbc2")).toEqual({ optionId: null });
  });

  it("shows a closed poll with results and no voting", async () => {
    mockApi({ "GET /polls/pollAbc2": () => json({ ...afterVote, closed: true }) });
    renderApp("/p/pollAbc2");

    expect(await screen.findByText("Closed")).toBeDefined();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/Sunday/).textContent).toContain("🏆");
  });

  it("explains when the poll does not exist", async () => {
    mockApi({ "GET /polls/missing1": () => apiError(404, "POLL_NOT_FOUND") });
    renderApp("/p/missing1");

    expect(await screen.findByRole("heading", { name: "Poll not found" })).toBeDefined();
  });

  it("shows an error with a retry button when the API is unreachable", async () => {
    let calls = 0;
    mockApi({
      "GET /polls/pollAbc2": () => {
        calls++;
        return calls === 1 ? Promise.reject(new TypeError("Failed to fetch")) : json(poll);
      },
    });
    const user = userEvent.setup();
    renderApp("/p/pollAbc2");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringMatching(/Could not reach the server/),
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Best day?" })).toBeDefined();
  });

  it("starts fresh when navigating straight from one poll to another", async () => {
    saveVote("pollAbc2", { optionId: "1" });
    mockApi({
      "GET /polls/pollAbc2": () => json(poll),
      "GET /polls/otherPo2": () => json(makePollView({ id: "otherPo2", question: "Other?" })),
    });
    const { navigate } = renderApp("/p/pollAbc2");
    expect(await screen.findByText("You voted for “Saturday”.")).toBeDefined();

    // Mesma rota (/p/:pollId), outro ID: o React Router reaproveita a PollPage.
    navigate("/p/otherPo2");

    expect(await screen.findByRole("heading", { name: "Other?" })).toBeDefined();
    expect(screen.queryByText(/You voted/)).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("does not flash an error when StrictMode cancels the first request", async () => {
    mockApi({ "GET /polls/pollAbc2": ({ signal }) => delayed(() => json(poll), 50, signal) });
    renderApp("/p/pollAbc2", { strict: true });

    // A 1ª requisição já foi cancelada pelo "ensaio" do StrictMode; a 2ª ainda está a caminho.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Loading poll…")).toBeDefined();

    expect(await screen.findByRole("heading", { name: "Best day?" })).toBeDefined();
  });

  describe("real time", () => {
    async function openLive() {
      mockApi({ "GET /polls/pollAbc2": () => json(poll) });
      const app = renderApp("/p/pollAbc2");
      await screen.findByRole("heading", { name: "Best day?" });
      const socket = app.sockets.latest();
      // act(): avisa o React que vamos causar atualizações de estado fora de um evento
      // de usuário, e espera ele terminar de redesenhar antes de seguirmos.
      act(() => socket.open());
      return { ...app, socket };
    }

    it("subscribes to the poll and shows how many people are watching", async () => {
      const { socket } = await openLive();

      act(() => socket.receive({ type: "viewers", pollId: "pollAbc2", count: 3 }));

      expect(socket.sent).toEqual([{ type: "subscribe", pollId: "pollAbc2" }]);
      expect(screen.getByText("Live · 3 watching")).toBeDefined();
    });

    it("updates the bars when someone else votes", async () => {
      const user = userEvent.setup();
      const { socket } = await openLive();
      await user.click(screen.getByRole("button", { name: "See results" }));

      act(() =>
        socket.receive({
          type: "poll:updated",
          pollId: "pollAbc2",
          totals: { "1": 1, "2": 3 },
          totalVotes: 4,
        }),
      );

      expect(screen.getByText("75% · 3")).toBeDefined();
      expect(screen.getByText("4 votes")).toBeDefined();
    });

    it("stops accepting votes when the poll is closed live", async () => {
      const { socket } = await openLive();

      act(() => socket.receive({ type: "poll:closed", pollId: "pollAbc2" }));

      expect(screen.getByText("Closed")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Vote" })).toBeNull();
    });

    it("explains when the poll is removed by the memory limit", async () => {
      const { socket } = await openLive();

      act(() => socket.receive({ type: "poll:removed", pollId: "pollAbc2" }));

      expect(screen.getByRole("alert").textContent).toMatch(/removed to free up memory/);
      expect(screen.queryByRole("button", { name: "Vote" })).toBeNull();
    });

    it("explains when the server restarted and forgot the poll", async () => {
      const { socket } = await openLive();

      act(() => socket.receive({ type: "error", code: "POLL_NOT_FOUND", message: "x" }));

      expect(screen.getByRole("alert").textContent).toMatch(/server restarted/);
    });

    it("shows 'Reconnecting…' when the connection drops", async () => {
      const { socket } = await openLive();

      act(() => socket.drop());

      expect(screen.getByText("Reconnecting…")).toBeDefined();
    });

    it("ignores messages about other polls", async () => {
      const { socket } = await openLive();

      act(() => socket.receive({ type: "poll:closed", pollId: "otherPo2" }));
      // Ex.: snapshot da enquete anterior, que chegou antes do servidor processar o unsubscribe
      act(() =>
        socket.receive({
          type: "poll:snapshot",
          poll: makePollView({ id: "otherPo2", question: "Other?" }),
        }),
      );

      expect(screen.queryByText("Closed")).toBeNull();
      expect(screen.getByRole("heading", { name: "Best day?" })).toBeDefined();
    });

    it("unsubscribes when leaving the page", async () => {
      const { socket, navigate } = await openLive();
      mockApi({ "GET /health": () => json({ status: "ok" }), "GET /polls": () => json([]) });

      navigate("/");

      expect(socket.sent.at(-1)).toEqual({ type: "unsubscribe", pollId: "pollAbc2" });
    });
  });

  it("can peek at the results before voting", async () => {
    mockApi({ "GET /polls/pollAbc2": () => json(poll) });
    const user = userEvent.setup();
    renderApp("/p/pollAbc2");

    await user.click(await screen.findByRole("button", { name: "See results" }));
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Back to voting" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  describe("sharing", () => {
    it("copies the poll link", async () => {
      mockApi({ "GET /polls/pollAbc2": () => json(poll) });
      // userEvent.setup() troca navigator.clipboard por um falso que guarda o texto.
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await user.click(await screen.findByRole("button", { name: "Copy link" }));

      expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/p/pollAbc2`);
      expect(screen.getByRole("button", { name: "Copied!" })).toBeDefined();
    });

    it("loads the QR code only when asked", async () => {
      mockApi({ "GET /polls/pollAbc2": () => json(poll) });
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await screen.findByRole("heading", { name: "Best day?" });
      expect(screen.queryByTitle("QR code to open this poll")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Show QR code" }));

      // findBy: o componente do QR é carregado de forma assíncrona (React.lazy)
      expect(await screen.findByTitle("QR code to open this poll")).toBeDefined();
    });
  });

  describe("admin", () => {
    const closedPoll = makePollView({ closed: true });

    function mockAdminApi(extra: MockRoutes = {}) {
      return mockApi({
        "GET /polls/pollAbc2": () => json(poll),
        "POST /polls/pollAbc2/close": ({ headers }) =>
          headers.get("X-Admin-Token") === "secret-token"
            ? json(closedPoll)
            : apiError(403, "FORBIDDEN"),
        ...extra,
      });
    }

    it("hides the admin panel from regular visitors", async () => {
      mockAdminApi();
      renderApp("/p/pollAbc2");

      await screen.findByRole("heading", { name: "Best day?" });
      expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
    });

    it("shows the admin panel to the creator (token saved at creation)", async () => {
      saveAdminToken("pollAbc2", "secret-token");
      mockAdminApi();
      renderApp("/p/pollAbc2");

      expect(await screen.findByRole("button", { name: "Close poll" })).toBeDefined();
    });

    it("saves the token from an admin link and removes it from the URL", async () => {
      mockAdminApi();
      const app = renderApp("/p/pollAbc2#admin=secret-token");

      expect(await screen.findByRole("button", { name: "Close poll" })).toBeDefined();
      expect(getAdminToken("pollAbc2")).toBe("secret-token");
      expect(app.location()?.hash).toBe("");
      expect(app.location()?.pathname).toBe("/p/pollAbc2");
    });

    it("handles the admin link under StrictMode too", async () => {
      mockAdminApi();
      const app = renderApp("/p/pollAbc2#admin=secret-token", { strict: true });

      expect(await screen.findByRole("button", { name: "Close poll" })).toBeDefined();
      expect(getAdminToken("pollAbc2")).toBe("secret-token");
      expect(app.location()?.hash).toBe("");
    });

    it("ignores a malformed token in the link", async () => {
      mockAdminApi();
      renderApp("/p/pollAbc2#admin=%3Cscript%3E");

      await screen.findByRole("heading", { name: "Best day?" });
      expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
      expect(getAdminToken("pollAbc2")).toBeUndefined();
    });

    it("asks for confirmation, then closes the poll with the token", async () => {
      saveAdminToken("pollAbc2", "secret-token");
      const fetchMock = mockAdminApi();
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await user.click(await screen.findByRole("button", { name: "Close poll" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Close poll" }));
      await user.click(screen.getByRole("button", { name: "Yes, close it" }));

      expect(await screen.findByText("This poll is closed. The results are final.")).toBeDefined();
      expect(screen.getByText("Closed")).toBeDefined();
      expect(screen.queryByRole("radio")).toBeNull();
      const closeCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/close"));
      expect(closeCalls).toHaveLength(1); // o "Cancel" não chamou a API
    });

    it("forgets a token the API rejects", async () => {
      saveAdminToken("pollAbc2", "wrong-token");
      mockAdminApi();
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await user.click(await screen.findByRole("button", { name: "Close poll" }));
      await user.click(screen.getByRole("button", { name: "Yes, close it" }));

      expect(await screen.findByText(/This admin link is not valid/)).toBeDefined();
      expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
      expect(getAdminToken("pollAbc2")).toBeUndefined();
    });

    it("keeps the panel and shows the error if closing fails for another reason", async () => {
      saveAdminToken("pollAbc2", "secret-token");
      mockAdminApi({
        "POST /polls/pollAbc2/close": () => apiError(500, "INTERNAL_ERROR"),
      });
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await user.click(await screen.findByRole("button", { name: "Close poll" }));
      await user.click(screen.getByRole("button", { name: "Yes, close it" }));

      expect((await screen.findByRole("alert")).textContent).toMatch(/Something went wrong/);
      expect(screen.getByRole("button", { name: "Yes, close it" })).toBeDefined();
      expect(getAdminToken("pollAbc2")).toBe("secret-token");
    });

    it("copies the admin link with the token", async () => {
      saveAdminToken("pollAbc2", "secret-token");
      mockAdminApi();
      const user = userEvent.setup();
      renderApp("/p/pollAbc2");

      await user.click(await screen.findByRole("button", { name: "Copy admin link" }));

      expect(await navigator.clipboard.readText()).toBe(
        `${window.location.origin}/p/pollAbc2#admin=secret-token`,
      );
    });

    it("hides sharing and admin when the poll is gone from the server", async () => {
      saveAdminToken("pollAbc2", "secret-token");
      mockAdminApi();
      const app = renderApp("/p/pollAbc2");
      await screen.findByRole("heading", { name: "Best day?" });
      const socket = app.sockets.latest();
      act(() => socket.open());

      act(() => socket.receive({ type: "poll:removed", pollId: "pollAbc2" }));

      expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
    });
  });
});
