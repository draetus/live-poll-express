import type { HealthResponse } from "@shared/api";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./App";

// MemoryRouter guarda a URL em memória (não existe barra de endereço no jsdom).
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("routes", () => {
  beforeEach(() => {
    // Nenhum teste de unidade deve depender de uma API de verdade no ar.
    const body: HealthResponse = { status: "ok" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );
  });

  it("renders the home page at /", async () => {
    renderAt("/");

    expect(screen.getByRole("heading", { level: 1 })).toHaveProperty(
      "textContent",
      "Create a poll. Share the link. Watch it live.",
    );
    // findBy* espera (até 1 s) o texto aparecer: o fetch é assíncrono
    expect(await screen.findByText("API online")).toBeDefined();
  });

  it("shows 'API offline' when the health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );

    renderAt("/");

    expect(await screen.findByText("API offline")).toBeDefined();
  });

  it("reads the poll id from the URL", () => {
    renderAt("/p/AbC23xyz");

    expect(screen.getByRole("heading", { name: "Poll AbC23xyz" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Presentation mode" })).toHaveProperty(
      "pathname",
      "/p/AbC23xyz/present",
    );
  });

  it("renders the presentation page without the site header", () => {
    renderAt("/p/AbC23xyz/present");

    expect(screen.getByRole("heading", { name: "Poll AbC23xyz" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Live Poll" })).toBeNull();
  });

  it("renders the 404 page for unknown routes", () => {
    renderAt("/does/not/exist");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeDefined();
  });
});
