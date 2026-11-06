import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { CopyButton } from "../../../components/CopyButton";
import { QrCode } from "../../../components/QrCode";
import { pollUrl } from "../links";

export function SharePanel({ pollId }: { pollId: string }) {
  const url = pollUrl(pollId);
  // O QR só é montado (e o chunk dele baixado) quando alguém pede.
  const [showQr, setShowQr] = useState(false);

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Share</h2>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Poll link"
          // Um clique seleciona o link inteiro: fácil de copiar à mão se o botão falhar.
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <CopyButton text={url}>Copy link</CopyButton>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
          {showQr ? "Hide QR code" : "Show QR code"}
        </Button>
        <Link
          to={`/p/${pollId}/present`}
          className="text-sm text-brand-600 underline dark:text-brand-500"
        >
          Presentation mode
        </Link>
      </div>

      {showQr && <QrCode value={url} size={192} title="QR code to open this poll" />}
    </Card>
  );
}
