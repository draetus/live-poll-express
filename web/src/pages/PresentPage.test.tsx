import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { apiError, json, makePollView, mockApi } from "../test/mock-api";
import { renderApp } from "../test/render-app";

const poll = makePollView();

async function openPresent() {
  mockApi({ "GET /polls/pollAbc2": () => json(poll) });
  const app = renderApp("/p/pollAbc2/present");
  await screen.findByRole("heading", { name: "Best day?" });
  const socket = app.sockets.latest();
  act(() => socket.open());
  return { ...app, socket };
}

describe("PresentPage", () => {
  it("shows the question, the results and a QR code to vote", async () => {
    await openPresent();

    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(await screen.findByTitle("QR code to vote on this poll")).toBeDefined();
    expect(screen.getByText("Scan to vote")).toBeDefined();
    // Projeção não tem cabeçalho do site
    expect(screen.queryByRole("link", { name: "Live Poll" })).toBeNull();
  });

  it("updates live as votes come in", async () => {
    const { socket } = await openPresent();

    act(() => {
      socket.receive({ type: "viewers", pollId: "pollAbc2", count: 12 });
      socket.receive({
        type: "poll:updated",
        pollId: "pollAbc2",
        totals: { "1": 3, "2": 1 },
        totalVotes: 4,
      });
    });

    expect(screen.getByText("4 votes")).toBeDefined();
    expect(screen.getByText("75% · 3")).toBeDefined();
    expect(screen.getByText("Live · 12 watching")).toBeDefined();
  });

  it("removes the QR code and highlights the winner when the poll closes", async () => {
    const { socket } = await openPresent();

    act(() => {
      socket.receive({
        type: "poll:updated",
        pollId: "pollAbc2",
        totals: { "1": 2, "2": 1 },
        totalVotes: 3,
      });
      socket.receive({ type: "poll:closed", pollId: "pollAbc2" });
    });

    expect(screen.getByText("Closed")).toBeDefined();
    expect(screen.getByText(/Saturday/).textContent).toContain("🏆");
    expect(screen.queryByText("Scan to vote")).toBeNull();
  });

  it("explains when the poll does not exist", async () => {
    mockApi({ "GET /polls/pollAbc2": () => apiError(404, "POLL_NOT_FOUND") });
    renderApp("/p/pollAbc2/present");

    expect(await screen.findByText("This poll does not exist or has expired.")).toBeDefined();
  });
});
