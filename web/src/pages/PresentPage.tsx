import { useParams } from "react-router";

// Tela para projetar numa TV/telão: só o gráfico, fonte grande, QR no canto (fase 6).
export function PresentPage() {
  const { pollId } = useParams();

  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <h1 className="text-5xl font-bold">Poll {pollId}</h1>
    </main>
  );
}
