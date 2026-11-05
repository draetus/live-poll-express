import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makePollView } from "../../../test/mock-api";
import { percentage, ResultBars } from "./ResultBars";

const voted = makePollView({
  options: [
    { id: "1", text: "Saturday", votes: 2 },
    { id: "2", text: "Sunday", votes: 1 },
  ],
  totalVotes: 3,
});

function barFor(name: string) {
  return screen.getByRole("progressbar", { name });
}

describe("percentage", () => {
  it("rounds and handles zero votes", () => {
    expect(percentage(2, 3)).toBe(67);
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(0, 0)).toBe(0);
  });
});

describe("ResultBars", () => {
  it("shows percentage and votes for each option and sizes the bars", () => {
    render(<ResultBars poll={voted} />);

    expect(screen.getByText("67% · 2")).toBeDefined();
    expect(screen.getByText("33% · 1")).toBeDefined();
    expect(barFor("Saturday").getAttribute("aria-valuenow")).toBe("67");
    expect((barFor("Saturday").firstElementChild as HTMLElement).style.width).toBe("67%");
  });

  it("does not break when nobody voted yet", () => {
    render(<ResultBars poll={makePollView()} />);

    expect(screen.getAllByText("0% · 0")).toHaveLength(2);
  });

  it("marks the option this browser voted for", () => {
    render(<ResultBars poll={voted} myOptionId="2" />);

    const sunday = screen.getByText("Sunday").closest("li") as HTMLElement;
    expect(within(sunday).getByText("your vote")).toBeDefined();
  });

  it("highlights the winner only when the poll is closed", () => {
    const { rerender } = render(<ResultBars poll={voted} />);
    expect(screen.queryByText(/🏆/)).toBeNull();

    rerender(<ResultBars poll={{ ...voted, closed: true }} />);

    expect(screen.getByText(/Saturday/).textContent).toContain("🏆");
    expect(screen.getByText(/Sunday/).textContent).not.toContain("🏆");
  });
});
