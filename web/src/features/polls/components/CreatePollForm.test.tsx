import { LIMITS } from "@shared/limits";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreatePollForm, validatePoll } from "./CreatePollForm";

describe("validatePoll", () => {
  it("accepts a valid poll", () => {
    expect(validatePoll("Best day?", ["Sat", "Sun"])).toEqual({});
  });

  it("checks the minimum question length after trimming", () => {
    expect(validatePoll("  Hi  ", ["A", "B"]).question).toBeDefined();
  });

  it("rejects empty and duplicated options (ignoring case and spaces)", () => {
    expect(validatePoll("Best day?", ["Sat", "  "]).options).toMatch(/Fill in/);
    expect(validatePoll("Best day?", ["Sat", " sat "]).options).toMatch(/different/);
  });
});

function setup({ disabled = false } = {}) {
  const onSubmit = vi.fn(async () => {});
  // userEvent simula um usuário de verdade: foco, teclado, clique (não só "dispara um evento")
  const user = userEvent.setup();
  render(<CreatePollForm onSubmit={onSubmit} disabled={disabled} />);
  return { onSubmit, user };
}

describe("CreatePollForm", () => {
  it("can be filled but not submitted while disabled (server waking up)", async () => {
    const { onSubmit, user } = setup({ disabled: true });

    await user.type(screen.getByLabelText("Question"), "Best day?");
    await user.type(screen.getByLabelText("Option 1"), "Saturday");
    // Pela especificação do HTML, Enter num campo NÃO envia o form se o botão de envio
    // estiver desabilitado. Por isso o componente não precisa de uma checagem extra.
    await user.type(screen.getByLabelText("Option 2"), "Sunday{Enter}");

    expect(screen.getByRole("button", { name: "Waiting for the server…" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed question and options", async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText("Question"), "  Best day?  ");
    await user.type(screen.getByLabelText("Option 1"), "Saturday");
    await user.type(screen.getByLabelText("Option 2"), " Sunday");
    await user.click(screen.getByRole("button", { name: "Create poll" }));

    expect(onSubmit).toHaveBeenCalledWith({
      question: "Best day?",
      options: ["Saturday", "Sunday"],
    });
  });

  it("shows validation errors and does not submit", async () => {
    const { onSubmit, user } = setup();

    await user.type(screen.getByLabelText("Question"), "Hi");
    await user.click(screen.getByRole("button", { name: "Create poll" }));

    expect(screen.getByText(/at least 3 characters/)).toBeDefined();
    expect(screen.getByText(/Fill in every option/)).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it(`adds options up to ${LIMITS.OPTIONS_MAX} and removes down to ${LIMITS.OPTIONS_MIN}`, async () => {
    const { user } = setup();
    const add = screen.getByRole("button", { name: "+ Add option" });

    for (let i = LIMITS.OPTIONS_MIN; i < LIMITS.OPTIONS_MAX; i++) await user.click(add);

    expect(screen.getAllByRole("textbox", { name: /^Option/ })).toHaveLength(LIMITS.OPTIONS_MAX);
    expect(add).toHaveProperty("disabled", true);

    for (let i = LIMITS.OPTIONS_MAX; i > LIMITS.OPTIONS_MIN; i--) {
      await user.click(screen.getByRole("button", { name: `Remove option ${i}` }));
    }

    expect(screen.getAllByRole("textbox", { name: /^Option/ })).toHaveLength(LIMITS.OPTIONS_MIN);
    expect(screen.getByRole("button", { name: "Remove option 1" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("removes the right option from the middle", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "+ Add option" }));
    await user.type(screen.getByLabelText("Option 1"), "A");
    await user.type(screen.getByLabelText("Option 2"), "B");
    await user.type(screen.getByLabelText("Option 3"), "C");

    await user.click(screen.getByRole("button", { name: "Remove option 2" }));

    expect(screen.getByLabelText("Option 1")).toHaveProperty("value", "A");
    expect(screen.getByLabelText("Option 2")).toHaveProperty("value", "C");
  });

  it("limits the text length with the shared limits", () => {
    setup();

    expect(screen.getByLabelText("Question").getAttribute("maxlength")).toBe(
      String(LIMITS.QUESTION_MAX),
    );
    expect(screen.getByLabelText("Option 1").getAttribute("maxlength")).toBe(
      String(LIMITS.OPTION_TEXT_MAX),
    );
  });
});
