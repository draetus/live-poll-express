import type { PollOptionView } from "@shared/api";
import { type FormEvent, useState } from "react";
import { Button } from "../../../components/Button";

interface VoteOptionsProps {
  options: PollOptionView[];
  onVote(optionId: string): void;
  submitting: boolean;
}

// Botões de rádio dentro de um <fieldset>: o navegador já cuida de teclado
// (setas mudam a seleção) e de leitores de tela, sem uma linha de código nossa.
export function VoteOptions({ options, onVote, submitting }: VoteOptionsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) onVote(selected);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose an option</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 has-checked:border-brand-500 has-checked:bg-brand-50 dark:border-slate-800 dark:has-checked:bg-slate-800"
          >
            <input
              type="radio"
              name="option"
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              className="accent-brand-600"
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={!selected || submitting} className="w-full">
        {submitting ? "Sending vote…" : "Vote"}
      </Button>
    </form>
  );
}
