import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { QrCode } from "../components/QrCode";
import { LiveStatus } from "../features/polls/components/LiveStatus";
import { ResultBars } from "../features/polls/components/ResultBars";
import { usePoll } from "../features/polls/hooks/usePoll";
import { pollUrl } from "../features/polls/links";

// Tela para projetar numa TV ou telão: só o gráfico, fonte grande e um QR no canto
// para a plateia votar pelo celular. Recebe as mudanças ao vivo, como a PollPage.
export function PresentPage() {
  const { pollId = "" } = useParams();
  return <PresentScreen key={pollId} pollId={pollId} />;
}

function PresentScreen({ pollId }: { pollId: string }) {
  const { state, reload } = usePoll(pollId);

  if (state.status === "loading") {
    return <FullScreen>Loading poll…</FullScreen>;
  }
  if (state.status === "not-found") {
    return <FullScreen>This poll does not exist or has expired.</FullScreen>;
  }
  if (state.status === "error") {
    return (
      <FullScreen>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={reload} className="mt-6 text-xl underline">
          Try again
        </button>
      </FullScreen>
    );
  }

  const { poll, viewers, ended, connection } = state;
  const url = pollUrl(poll.id);

  return (
    <main className="flex min-h-dvh flex-col gap-10 p-8 lg:p-14">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          {poll.closed && (
            <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-lg font-medium dark:bg-slate-800">
              Closed
            </span>
          )}
          <h1 className="text-4xl font-bold tracking-tight lg:text-6xl">{poll.question}</h1>
        </div>
        <Link to={`/p/${poll.id}`} className="shrink-0 text-sm text-slate-500 underline">
          Exit
        </Link>
      </header>

      <div className="flex-1">
        <ResultBars poll={poll} size="large" />
      </div>

      <footer className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2 text-xl">
          <p className="tabular-nums">
            {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
          </p>
          {ended ? (
            <p role="alert" className="text-amber-700 dark:text-amber-300">
              This poll is no longer on the server. These are the last results received.
            </p>
          ) : (
            <LiveStatus viewers={viewers} connection={connection} />
          )}
        </div>

        {/* Encerrada ou expirada, não há mais o que votar: o QR sai de cena. */}
        {!poll.closed && !ended && (
          <figure className="flex flex-col items-center gap-2">
            <QrCode value={url} size={176} title="QR code to vote on this poll" />
            <figcaption className="text-center text-sm text-slate-500">
              Scan to vote
              <br />
              <span className="font-mono">{url.replace(/^https?:\/\//, "")}</span>
            </figcaption>
          </figure>
        )}
      </footer>
    </main>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center text-3xl text-slate-500">
      <div>{children}</div>
    </main>
  );
}
