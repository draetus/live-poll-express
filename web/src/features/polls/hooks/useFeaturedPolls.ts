import type { PollSummary } from "@shared/api";
import { useEffect, useState } from "react";
import { useServerStatus } from "../../../app/ServerStatusProvider";
import { errorMessage } from "../../../lib/error-messages";
import { isAbortError } from "../../../lib/http";
import { pollsApi } from "../api";

export type FeaturedState =
  | { status: "loading" }
  | { status: "ready"; polls: PollSummary[] }
  | { status: "error"; message: string };

// As enquetes de destaque (seed) mostradas na Home.
// Só busca depois que o servidor responde: durante o cold start, o skeleton continua.
export function useFeaturedPolls(): FeaturedState {
  const [state, setState] = useState<FeaturedState>({ status: "loading" });
  const online = useServerStatus().status === "online";

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    pollsApi.listFeatured(controller.signal).then(
      (polls) => setState({ status: "ready", polls }),
      (err: unknown) => {
        if (!isAbortError(err)) setState({ status: "error", message: errorMessage(err) });
      },
    );
    return () => controller.abort();
  }, [online]);

  return state;
}
