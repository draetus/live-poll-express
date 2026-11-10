import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QrCode } from "./QrCode";

// Simula o chunk do QR falhando ao baixar (ex.: um deploy novo apagou o arquivo antigo).
// vi.mock é "içado" para o topo do arquivo: vale para todos os imports deste teste.
vi.mock("qrcode.react", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("QrCode", () => {
  it("shows a fallback instead of crashing when the QR code fails to load", async () => {
    render(<QrCode value="https://example.com/p/pollAbc2" size={120} title="QR" />);

    expect(await screen.findByText("QR code unavailable. Use the link instead.")).toBeDefined();
  });
});
