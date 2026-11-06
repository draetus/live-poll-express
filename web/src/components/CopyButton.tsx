import { type ReactNode, useEffect, useState } from "react";
import { Button } from "./Button";

type CopyStatus = "idle" | "copied" | "failed";

interface CopyButtonProps {
  text: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

// Copia `text` para a área de transferência e mostra "Copied!" por 2 segundos.
export function CopyButton({ text, children, variant = "secondary" }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  // O efeito que agenda a volta para "idle" também a cancela no cleanup:
  // se o componente sumir antes dos 2 s, nenhum setState acontece "no vazio".
  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      // navigator.clipboard só existe em contexto seguro (HTTPS ou localhost).
      // Aberto por http://192.168.x.x, por exemplo, ele é undefined e cai no catch.
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <Button variant={variant} onClick={copy}>
      {/* aria-live: o leitor de tela anuncia "Copied!" sem o foco sair do botão */}
      <span aria-live="polite">
        {status === "copied" ? "Copied!" : status === "failed" ? "Could not copy" : children}
      </span>
    </Button>
  );
}
