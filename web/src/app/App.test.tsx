import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { json, makePollView, mockApi } from "../test/mock-api";
import { renderApp } from "../test/render-app";

describe("routes", () => {
  beforeEach(() => {
    // Nenhum teste de unidade deve depender de uma API de verdade no ar.
    mockApi({
      "GET /health": () => json({ status: "ok" }),
      "GET /polls": () => json([]),
      "GET /polls/AbC23xyz": () => json(makePollView({ id: "AbC23xyz" })),
    });
  });

  it("renders the home page at /", async () => {
    renderApp("/");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Create a poll. Share the link. Watch it live.",
    );
    // findBy* espera (até 1 s) o texto aparecer: o fetch é assíncrono
    expect(await screen.findByText("API online")).toBeDefined();
  });

  it("shows 'API offline' when the health check fails", async () => {
    mockApi({ "GET /health": () => Promise.reject(new TypeError("Failed to fetch")) });

    renderApp("/");

    expect(await screen.findByText("API offline")).toBeDefined();
  });

  it("renders the poll page for /p/:pollId", async () => {
    renderApp("/p/AbC23xyz");

    expect(await screen.findByRole("heading", { name: "Best day?" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Presentation mode" }).getAttribute("href")).toBe(
      "/p/AbC23xyz/present",
    );
  });

  it("renders the presentation page without the site header", () => {
    renderApp("/p/AbC23xyz/present");

    expect(screen.getByRole("heading", { name: "Poll AbC23xyz" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Live Poll" })).toBeNull();
  });

  it("renders the 404 page for unknown routes", () => {
    renderApp("/does/not/exist");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeDefined();
  });
});
