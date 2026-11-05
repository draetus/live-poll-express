import type { PollView } from "@shared/api";
import { useState } from "react";
import { errorMessage } from "../../../lib/error-messages";
import { ApiError } from "../../../lib/http";
import { pollsApi } from "../api";
import { getVote, getVoterId, type StoredVote, saveVote } from "../storage";

interface UseVoteOptions {
  /** A API devolveu o estado novo da enquete. */
  onVoted(poll: PollView): void;
  /** O que temos na tela ficou desatualizado (enquete encerrada, já votou...). */
  onStale(): void;
}

export function useVote(pollId: string, { onVoted, onStale }: UseVoteOptions) {
  // Função no useState: lê o storage UMA vez, na montagem, e não a cada renderização.
  const [myVote, setMyVote] = useState<StoredVote | undefined>(() => getVote(pollId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remember(vote: StoredVote) {
    saveVote(pollId, vote);
    setMyVote(vote);
  }

  async function vote(optionId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const poll = await pollsApi.vote(pollId, { optionId, voterId: getVoterId() });
      remember({ optionId });
      onVoted(poll);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_VOTED") {
        // Ex.: o usuário limpou o storage, mas o servidor lembra. Não é um erro grave:
        // mostramos o resultado, sem saber em qual opção ele votou.
        remember({ optionId: null });
        onStale();
      } else if (err instanceof ApiError && ["POLL_CLOSED", "POLL_NOT_FOUND"].includes(err.code)) {
        setError(errorMessage(err));
        onStale(); // recarrega para mostrar "encerrada" ou "não encontrada"
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { myVote, vote, submitting, error };
}
