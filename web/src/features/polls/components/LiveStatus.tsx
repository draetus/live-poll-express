import type { ConnectionState } from "../../../lib/realtime-client";

interface LiveStatusProps {
  viewers: number | null;
  connection: ConnectionState;
}

// "Ao vivo · 3 watching" quando conectado; "Reconnecting…" quando a conexão caiu.
// role="status" + aria-live: leitores de tela anunciam a mudança sem roubar o foco.
export function LiveStatus({ viewers, connection }: LiveStatusProps) {
  const live = connection === "open";
  const reconnecting = connection === "reconnecting";

  return (
    <p
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 tabular-nums"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : reconnecting ? "bg-amber-400" : "bg-slate-400"}`}
      />
      {live && (viewers === null ? "Live" : `Live · ${viewers} watching`)}
      {reconnecting && "Reconnecting…"}
      {(connection === "connecting" || connection === "idle") && "Connecting…"}
    </p>
  );
}
