import type { PollView } from "@shared/api";
import { useState } from "react";
import { errorMessage } from "../../../lib/error-messages";
import { ApiError } from "../../../lib/http";
import { pollsApi } from "../api";

interface UseClosePollOptions {
  /** A API devolveu a enquete já encerrada. */
  onClosed(poll: PollView): void;
  /** O token foi recusado (403). */
  onForbidden(): void;
  /** A enquete não existe mais no servidor. */
  onStale(): void;
}

export function useClosePoll(
  pollId: string,
  token: string,
  { onClosed, onForbidden, onStale }: UseClosePollOptions,
) {
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    setClosing(true);
    setError(null);
    try {
      onClosed(await pollsApi.close(pollId, token));
    } catch (err) {
      if (err instanceof ApiError && err.code === "FORBIDDEN") {
        onForbidden();
      } else if (err instanceof ApiError && err.code === "POLL_NOT_FOUND") {
        onStale();
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setClosing(false);
    }
  }

  return { close, closing, error };
}
