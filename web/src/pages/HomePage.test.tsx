import type { CreatePollResponse } from "@shared/api";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getAdminToken } from "../features/polls/storage";
import { apiError, json, type MockRequest, makePollView, mockApi } from "../test/mock-api";
import { renderApp } from "../test/render-app";

const featured = [
  { id: "seedTabs", question: "Tabs or spaces?", totalVotes: 3, closed: false },
  { id: "seedCafe", question: "Coffee or tea?", totalVotes: 1, closed: false },
];

function baseRoutes() {
  return {
    "GET /health": () => json({ status: "ok" }),
    "GET /polls": () => json(featured),
  };
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Question"), "Pizza or burger?");
  await user.type(screen.getByLabelText("Option 1"), "Pizza");
  await user.type(screen.getByLabelText("Option 2"), "Burger");
  await user.click(screen.getByRole("button", { name: "Create poll" }));
}

describe("HomePage", () => {
  it("lists the featured polls with links", async () => {
    mockApi(baseRoutes());
    renderApp("/");

    const link = await screen.findByRole("link", { name: /Tabs or spaces\?/ });
    expect(link.getAttribute("href")).toBe("/p/seedTabs");
    expect(screen.getByText("1 vote")).toBeDefined();
  });

  it("creates a poll, keeps the admin token and opens the new poll", async () => {
    const created: CreatePollResponse = {
      poll: makePollView({ id: "newPoll2", question: "Pizza or burger?" }),
      adminToken: "secret-admin-token",
    };
    let sent: MockRequest | undefined;
    mockApi({
      ...baseRoutes(),
      "POST /polls": (req) => {
        sent = req;
        return json(created, 201);
      },
      "GET /polls/newPoll2": () => json(created.poll),
    });
    const user = userEvent.setup();
    renderApp("/");

    await fillForm(user);

    expect(await screen.findByRole("heading", { name: "Pizza or burger?" })).toBeDefined();
    expect(sent?.body).toEqual({ question: "Pizza or burger?", options: ["Pizza", "Burger"] });
    expect(getAdminToken("newPoll2")).toBe("secret-admin-token");
  });

  it("shows the API error and stays on the form when creation fails", async () => {
    mockApi({ ...baseRoutes(), "POST /polls": () => apiError(429, "RATE_LIMITED") });
    const user = userEvent.setup();
    renderApp("/");

    await fillForm(user);

    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many attempts/);
    expect(screen.getByLabelText("Question")).toHaveProperty("value", "Pizza or burger?");
  });

  it("says how long to wait when the API sends Retry-After", async () => {
    mockApi({
      ...baseRoutes(),
      "POST /polls": () => {
        const res = apiError(429, "RATE_LIMITED");
        res.headers.set("Retry-After", "42");
        return res;
      },
    });
    const user = userEvent.setup();
    renderApp("/");

    await fillForm(user);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many attempts. Please try again in 42 seconds.",
    );
  });
});
