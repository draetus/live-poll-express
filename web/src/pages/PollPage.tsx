import type { PollView } from "@shared/api";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { AdminPanel } from "../features/polls/components/AdminPanel";
import { LiveStatus } from "../features/polls/components/LiveStatus";
import { ResultBars } from "../features/polls/components/ResultBars";
import { SharePanel } from "../features/polls/components/SharePanel";
import { VoteOptions } from "../features/polls/components/VoteOptions";
import { useAdminToken } from "../features/polls/hooks/useAdminToken";
import { usePoll } from "../features/polls/hooks/usePoll";
import { useVote } from "../features/polls/hooks/useVote";
import type { PollEnding } from "../features/polls/poll-reducer";
import type { ConnectionState } from "../lib/realtime-client";

export function PollPage() {
  const { pollId = "" } = useParams();
  // key={pollId}: ao navegar de uma enquete para outra, o React Router REAPROVEITA
  // este componente. A key diferente força o React a criar um PollScreen novo,
  // com todo o estado (voto, erros, dados) zerado.
  return <PollScreen key={pollId} pollId={pollId} />;
}

function PollScreen({ pollId }: { pollId: string }) {
  const { state, reload, applyPoll } = usePoll(pollId);
  // Antes dos `return`s abaixo: hooks não podem ser chamados condicionalmente.
  // Ler o link de admin já aqui também tira o #admin=... da URL enquanto a enquete carrega.
  const admin = useAdminToken(pollId);

  if (state.status === "loading") {
    return <p className="text-slate-500 dark:text-slate-400">Loading poll…</p>;
  }

  if (state.status === "not-found") {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Poll not found</h1>
        <p className="text-slate-600 dark:text-slate-400">
          This poll does not exist or has expired. Polls live in memory, so they disappear when the
          server restarts.
        </p>
        <Link to="/" className="text-brand-600 underline dark:text-brand-500">
          Create a new poll
        </Link>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="space-y-3">
        <p role="alert" className="text-rose-600 dark:text-rose-400">
          {state.message}
        </p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    );
  }

  return (
    <PollDetails
      poll={state.poll}
      viewers={state.viewers}
      ended={state.ended}
      connection={state.connection}
      adminToken={admin.token}
      adminRejected={admin.rejected}
      onPollChanged={applyPoll}
      onAdminRejected={admin.reject}
      onStale={reload}
    />
  );
}

const ENDING_MESSAGES: Record<PollEnding, string> = {
  removed: "This poll was removed to free up memory. The results below are the last ones received.",
  "server-restarted":
    "This poll expired because the server restarted (polls live in memory). The results below are the last ones received.",
};

interface PollDetailsProps {
  poll: PollView;
  viewers: number | null;
  ended: PollEnding | null;
  connection: ConnectionState;
  adminToken: string | undefined;
  adminRejected: boolean;
  /** Uma resposta da API trouxe a enquete atualizada (voto ou encerramento). */
  onPollChanged(poll: PollView): void;
  onAdminRejected(): void;
  onStale(): void;
}

function PollDetails({
  poll,
  viewers,
  ended,
  connection,
  adminToken,
  adminRejected,
  onPollChanged,
  onAdminRejected,
  onStale,
}: PollDetailsProps) {
  const { myVote, vote, submitting, error } = useVote(poll.id, {
    onVoted: onPollChanged,
    onStale,
  });
  const [showResults, setShowResults] = useState(false);
  const canVote = !poll.closed && !myVote && !ended;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        {poll.closed && (
          <span className="inline-block rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium dark:bg-slate-800">
            Closed
          </span>
        )}
        <h1 className="text-2xl font-bold">{poll.question}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
            {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
          </p>
          {!ended && <LiveStatus viewers={viewers} connection={connection} />}
        </div>
      </header>

      {ended && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {ENDING_MESSAGES[ended]}{" "}
          <Link to="/" className="underline">
            Create a new poll
          </Link>
        </p>
      )}

      <Card className="space-y-4">
        {canVote && !showResults ? (
          <VoteOptions options={poll.options} onVote={vote} submitting={submitting} />
        ) : (
          <ResultBars poll={poll} myOptionId={myVote?.optionId} />
        )}

        {myVote && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {myVote.optionId === null
              ? "You have already voted on this poll."
              : `You voted for “${poll.options.find((o) => o.id === myVote.optionId)?.text}”.`}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {canVote && (
          <Button variant="ghost" onClick={() => setShowResults((v) => !v)}>
            {showResults ? "Back to voting" : "See results"}
          </Button>
        )}
      </Card>

      {adminRejected && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          This admin link is not valid for this poll, so the admin options were removed.
        </p>
      )}

      {/* Enquete que sumiu do servidor: não há o que compartilhar nem encerrar. */}
      {!ended && <SharePanel pollId={poll.id} />}
      {!ended && adminToken && (
        <AdminPanel
          poll={poll}
          token={adminToken}
          onClosed={onPollChanged}
          onForbidden={onAdminRejected}
          onStale={onStale}
        />
      )}
    </section>
  );
}
