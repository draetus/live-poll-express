import { Link, useParams } from "react-router";

export function PollPage() {
  // useParams lê os segmentos dinâmicos da URL: em /p/AbC23xyz, pollId = "AbC23xyz"
  const { pollId } = useParams();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Poll {pollId}</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Voting and live results arrive in phases 4 and 5.
      </p>
      <Link to={`/p/${pollId}/present`} className="text-brand-600 underline dark:text-brand-500">
        Presentation mode
      </Link>
    </section>
  );
}
