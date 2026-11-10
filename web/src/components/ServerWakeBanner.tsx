import { useServerStatus } from "../app/ServerStatusProvider";
import { Button } from "./Button";

// Aviso de cold start: o plano grátis do Render "dorme" depois de ~15 min sem tráfego,
// e a primeira visita espera o servidor acordar. Sem este aviso, o site parece quebrado.
export function ServerWakeBanner() {
  const { status, retry } = useServerStatus();

  if (status === "waking") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
        <span>
          Starting the server (free tier)… This usually takes less than a minute, and only happens
          on the first visit after a while.
        </span>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-200"
      >
        <span>The server is not responding right now.</span>
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  return null; // checking (rápido demais para valer um aviso) ou online
}
