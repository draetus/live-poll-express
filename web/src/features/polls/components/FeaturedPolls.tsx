import { Link } from "react-router";
import { useFeaturedPolls } from "../hooks/useFeaturedPolls";

export function FeaturedPolls() {
  const state = useFeaturedPolls();

  return (
    <section aria-labelledby="featured-title" className="space-y-3">
      <h2 id="featured-title" className="text-lg font-semibold">
        Try one of these
      </h2>

      {state.status === "loading" && (
        // Skeleton: blocos cinza pulsando no lugar dos itens, enquanto carrega
        <ul className="space-y-2" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <li key={n} className="h-14 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.message}</p>
      )}

      {state.status === "ready" && (
        <ul className="space-y-2">
          {state.polls.map((poll) => (
            <li key={poll.id}>
              <Link
                to={`/p/${poll.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <span>{poll.question}</span>
                <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
