import type { PollSummary } from "@shared/api";
import { useEffect, useState } from "react";
import { errorMessage } from "../../../lib/error-messages";
import { isAbortError } from "../../../lib/http";
import { pollsApi } from "../api";

export type FeaturedState =
  | { status: "loading" }
  | { status: "ready"; polls: PollSummary[] }
  | { status: "error"; message: string };

// As enquetes de destaque (seed) mostradas na Home.
export function useFeaturedPolls(): FeaturedState {
  const [state, setState] = useState<FeaturedState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    pollsApi.listFeatured(controller.signal).then(
      (polls) => setState({ status: "ready", polls }),
      (err: unknown) => {
        if (!isAbortError(err)) setState({ status: "error", message: errorMessage(err) });
      },
    );
    return () => controller.abort();
  }, []);

  return state;
}
