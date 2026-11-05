import type { CreatePollRequest } from "@shared/api";
import { LIMITS } from "@shared/limits";
import { type FormEvent, useState } from "react";
import { Button } from "../../../components/Button";

export interface FormErrors {
  question?: string;
  options?: string;
}

// Mesmas regras do schema Zod da API, usando os MESMOS limites do shared/.
// Validar no front é conforto (resposta imediata); quem garante é sempre o servidor.
export function validatePoll(question: string, options: string[]): FormErrors {
  const errors: FormErrors = {};
  const q = question.trim();
  if (q.length < LIMITS.QUESTION_MIN) {
    errors.question = `The question needs at least ${LIMITS.QUESTION_MIN} characters.`;
  }

  const filled = options.map((o) => o.trim());
  if (filled.some((o) => o.length === 0)) {
    errors.options = "Fill in every option or remove the empty ones.";
  } else if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) {
    errors.options = "Options must be different from each other.";
  }
  return errors;
}

interface CreatePollFormProps {
  onSubmit(input: CreatePollRequest): Promise<void>;
  /** Mensagem de erro vinda da API, mostrada abaixo do botão. */
  submitError?: string | null;
}

export function CreatePollForm({ onSubmit, submitError }: CreatePollFormProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Estado é IMUTÁVEL: nunca options[i] = x. Criamos um array novo e o entregamos ao React,
  // que compara referências para saber que algo mudou e precisa redesenhar.
  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  }

  function addOption() {
    setOptions((current) => (current.length < LIMITS.OPTIONS_MAX ? [...current, ""] : current));
  }

  function removeOption(index: number) {
    setOptions((current) =>
      current.length > LIMITS.OPTIONS_MIN ? current.filter((_, i) => i !== index) : current,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // sem isto, o navegador recarregaria a página (envio "clássico")
    const found = validatePoll(question, options);
    setErrors(found);
    if (found.question || found.options) return;

    setSubmitting(true);
    try {
      await onSubmit({ question: question.trim(), options: options.map((o) => o.trim()) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // noValidate: as mensagens de erro são nossas, não os balões padrão do navegador
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="question" className="block text-sm font-medium">
          Question
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={LIMITS.QUESTION_MAX}
          placeholder="What should we have for lunch?"
          aria-invalid={errors.question ? true : undefined}
          aria-describedby={errors.question ? "question-error" : undefined}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
        {errors.question && (
          <p id="question-error" className="text-sm text-rose-600 dark:text-rose-400">
            {errors.question}
          </p>
        )}
      </div>

      <fieldset
        className="space-y-2"
        aria-describedby={errors.options ? "options-error" : undefined}
      >
        <legend className="mb-1.5 text-sm font-medium">
          Options ({options.length}/{LIMITS.OPTIONS_MAX})
        </legend>
        {options.map((option, index) => (
          // key={index} é aceitável aqui: os campos não têm ID próprio e o estado
          // de cada um vive no array `options`, não dentro do <input>.
          // biome-ignore lint/suspicious/noArrayIndexKey: ver comentário acima
          <div key={index} className="flex gap-2">
            <input
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              maxLength={LIMITS.OPTION_TEXT_MAX}
              placeholder={`Option ${index + 1}`}
              aria-label={`Option ${index + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <Button
              variant="ghost"
              onClick={() => removeOption(index)}
              disabled={options.length <= LIMITS.OPTIONS_MIN}
              aria-label={`Remove option ${index + 1}`}
            >
              ✕
            </Button>
          </div>
        ))}
        {errors.options && (
          <p id="options-error" className="text-sm text-rose-600 dark:text-rose-400">
            {errors.options}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={addOption}
          disabled={options.length >= LIMITS.OPTIONS_MAX}
        >
          + Add option
        </Button>
      </fieldset>

      <div className="space-y-2">
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create poll"}
        </Button>
        {submitError && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {submitError}
          </p>
        )}
      </div>
    </form>
  );
}
