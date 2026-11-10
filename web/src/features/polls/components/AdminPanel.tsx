import type { PollView } from "@shared/api";
import { useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { CopyButton } from "../../../components/CopyButton";
import { useClosePoll } from "../hooks/useClosePoll";
import { adminUrl } from "../links";

interface AdminPanelProps {
  poll: PollView;
  token: string;
  onClosed(poll: PollView): void;
  onForbidden(): void;
  onStale(): void;
}

export function AdminPanel({ poll, token, onClosed, onForbidden, onStale }: AdminPanelProps) {
  const { close, closing, error } = useClosePoll(poll.id, token, {
    onClosed,
    onForbidden,
    onStale,
  });
  // Encerrar não tem volta: pedimos confirmação num segundo clique, na própria página
  // (window.confirm bloqueia a aba inteira e não pode ser estilizado).
  const [confirming, setConfirming] = useState(false);
  const link = adminUrl(poll.id, token);

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Admin</h2>

      {poll.closed ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This poll is closed. The results are final.
        </p>
      ) : confirming ? (
        <div className="space-y-2">
          <p className="text-sm">Close the poll? Nobody will be able to vote after this.</p>
          <div className="flex gap-2">
            <Button onClick={close} disabled={closing}>
              {closing ? "Closing…" : "Yes, close it"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={closing}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Close poll
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* O link não fica exposto na tela (prints!). <details> é um "abre e fecha" nativo
          do HTML: acessível e sem JavaScript, e serve de plano B se copiar falhar. */}
      <div className="space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
        <p className="text-slate-600 dark:text-slate-400">
          The admin link lets you close this poll from another device. Anyone who has it can do the
          same, so keep it private.
        </p>
        <CopyButton text={link} variant="ghost">
          Copy admin link
        </CopyButton>
        <details>
          <summary className="cursor-pointer text-slate-500 dark:text-slate-400">Show admin link</summary>
          <input
            readOnly
            value={link}
            aria-label="Admin link"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </details>
      </div>
    </Card>
  );
}
