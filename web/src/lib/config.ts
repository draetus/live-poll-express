// Configuração lida das variáveis de ambiente do Vite (definidas em tempo de BUILD).
// Em dev, há defaults apontando para a API local. Em produção, a variável é obrigatória:
// é melhor quebrar de forma óbvia do que o site publicado tentar falar com "localhost".
function readUrl(value: string | undefined, devDefault: string, name: string): string {
  const url = value || (import.meta.env.DEV ? devDefault : undefined);
  if (!url) throw new Error(`Missing ${name}. Set it in the Vercel project settings.`);
  return url.replace(/\/+$/, ""); // sem barra final: evita "//health"
}

export const config = {
  apiUrl: readUrl(import.meta.env.VITE_API_URL, "http://localhost:3000", "VITE_API_URL"),
  wsUrl: readUrl(import.meta.env.VITE_WS_URL, "ws://localhost:3000/ws", "VITE_WS_URL"),
} as const;
