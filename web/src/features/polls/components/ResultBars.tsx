import type { PollView } from "@shared/api";

interface ResultBarsProps {
  poll: PollView;
  /** Opção em que este navegador votou (ganha um selo "your vote"). */
  myOptionId?: string | null;
  size?: "normal" | "large";
}

export function percentage(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100);
}

// Gráfico de barras em CSS puro: a largura de cada barra é a porcentagem.
// Quando a largura muda, `transition-[width]` anima sozinho — sem biblioteca de gráficos.
export function ResultBars({ poll, myOptionId, size = "normal" }: ResultBarsProps) {
  const maxVotes = Math.max(...poll.options.map((o) => o.votes));
  const large = size === "large";

  return (
    <ul className={large ? "space-y-6" : "space-y-3"} aria-label="Results">
      {poll.options.map((option) => {
        const pct = percentage(option.votes, poll.totalVotes);
        // Destaque da vencedora só com a enquete encerrada (empates destacam todas).
        const isWinner = poll.closed && poll.totalVotes > 0 && option.votes === maxVotes;
        return (
          <li key={option.id} className="space-y-1">
            <div className={`flex justify-between gap-4 ${large ? "text-2xl" : "text-sm"}`}>
              <span className={isWinner ? "font-semibold" : undefined}>
                {option.text}
                {isWinner && " 🏆"}
                {myOptionId === option.id && (
                  <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">
                    your vote
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                {pct}% · {option.votes}
              </span>
            </div>
            <div
              className={`overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ${large ? "h-6" : "h-3"}`}
              role="progressbar"
              aria-label={option.text}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${isWinner ? "bg-emerald-500" : "bg-brand-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
