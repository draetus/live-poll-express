import { type ComponentType, lazy, Suspense } from "react";

// Só as props que usamos: assim o QR real e o substituto de erro têm o mesmo "formato".
interface QrSvgProps {
  value: string;
  size: number;
  title: string;
  marginSize: number;
  className: string;
}

// React.lazy: o código do qrcode.react vira um arquivo separado (um "chunk"), baixado
// só quando um QR aparece pela primeira vez. A Home não paga por ele.
// lazy() espera um módulo com `default`; o pacote exporta { QRCodeSVG }, então adaptamos.
// O catch cobre a falha de download (rede caiu, ou um deploy novo apagou o chunk antigo):
// sem ele, o erro subiria até a raiz e derrubaria a página inteira.
const QRCodeSVG = lazy(async (): Promise<{ default: ComponentType<QrSvgProps> }> => {
  try {
    const module = await import("qrcode.react");
    return { default: module.QRCodeSVG };
  } catch {
    return { default: QrUnavailable };
  }
});

function QrUnavailable({ size }: QrSvgProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className="grid place-items-center rounded-lg bg-slate-100 p-2 text-center text-xs text-slate-500 dark:bg-slate-800"
    >
      QR code unavailable. Use the link instead.
    </div>
  );
}

interface QrCodeProps {
  value: string;
  size: number;
  /** Texto alternativo: vira o <title> do SVG, lido por leitores de tela. */
  title: string;
}

export function QrCode({ value, size, title }: QrCodeProps) {
  return (
    // Suspense mostra o `fallback` enquanto o chunk é baixado.
    <Suspense
      fallback={
        <div
          style={{ width: size, height: size }}
          className="animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"
        />
      }
    >
      {/* Fundo branco mesmo no modo escuro: leitores de QR precisam de contraste. */}
      <QRCodeSVG
        value={value}
        size={size}
        title={title}
        marginSize={2}
        className="rounded-lg bg-white"
      />
    </Suspense>
  );
}
