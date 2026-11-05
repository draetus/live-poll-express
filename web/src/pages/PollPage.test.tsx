import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, type NavigateFunction, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../app/App";
import { getVote, saveVote } from "../features/polls/storage";
import { apiError, delayed, json, makePollView, mockApi } from "../test/mock-api";
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
    let navigate: NavigateFunction = () => {};
    function CaptureNavigate() {
      navigate = useNavigate();
      return null;
    }
    render(
      <MemoryRouter initialEntries={["/p/pollAbc2"]}>
        <CaptureNavigate />
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText("You voted for “Saturday”.")).toBeDefined();

    // Mesma rota (/p/:pollId), outro ID: o React Router reaproveita a PollPage.
    act(() => {
      void navigate("/p/otherPo2");
    });

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

  it("can peek at the results before voting", async () => {
    mockApi({ "GET /polls/pollAbc2": () => json(poll) });
    const user = userEvent.setup();
    renderApp("/p/pollAbc2");

    await user.click(await screen.findByRole("button", { name: "See results" }));
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Back to voting" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
