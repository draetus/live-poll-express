import type { CreatePollRequest } from "@shared/api";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useServerStatus } from "../app/ServerStatusProvider";
import { Card } from "../components/Card";
import { DemoBanner } from "../components/DemoBanner";
import { pollsApi } from "../features/polls/api";
import { CreatePollForm } from "../features/polls/components/CreatePollForm";
import { FeaturedPolls } from "../features/polls/components/FeaturedPolls";
import { saveAdminToken } from "../features/polls/storage";
import { errorMessage } from "../lib/error-messages";

export function HomePage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const online = useServerStatus().status === "online";

  async function handleCreate(input: CreatePollRequest) {
    setSubmitError(null);
    try {
      const { poll, adminToken } = await pollsApi.create(input);
      // O token só vem nesta resposta: se não guardarmos agora, ele se perde.
      saveAdminToken(poll.id, adminToken);
      navigate(`/p/${poll.id}`);
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Create a poll. Share the link. Watch it live.
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Votes appear on every screen in real time, without refreshing the page.
        </p>
        <DemoBanner />
      </section>

      <Card>
        <CreatePollForm onSubmit={handleCreate} submitError={submitError} disabled={!online} />
      </Card>

      <FeaturedPolls />
    </div>
  );
}
