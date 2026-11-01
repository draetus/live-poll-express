import { z } from "zod";

// Lista de origens separadas por vírgula → array de origens normalizadas.
// `new URL(x).origin` remove barra final e caminho: "https://app.vercel.app/" vira
// "https://app.vercel.app", que é exatamente o formato do header Origin do navegador.
const originList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1))
  .transform((urls) => urls.map((url) => new URL(url).origin));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: originList.default(["http://localhost:5173"]),
  // Máximo de enquetes criadas por usuários em memória (as do seed não contam).
  MAX_POLLS: z.coerce.number().int().min(1).default(500),
});

export type Env = z.infer<typeof envSchema>;

// Função pura: recebe um objeto qualquer e devolve um Env válido (ou lança erro).
// Os testes chamam esta função direto, sem depender do process.env real.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  // Em produção, o default "localhost" bloquearia o site real em silêncio. Melhor não subir.
  if (result.data.NODE_ENV === "production" && !source.CORS_ORIGINS) {
    throw new Error("Invalid environment variables:\n✖ CORS_ORIGINS is required in production");
  }
  return result.data;
}

// Ponto de entrada usado pelo server.ts.
export function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "development") {
    try {
      // Nativo do Node (dispensa o pacote dotenv). Lê ./.env relativo ao diretório atual.
      // Variáveis que já existem no ambiente NÃO são sobrescritas pelo arquivo.
      process.loadEnvFile();
    } catch {
      // Sem .env: tudo bem, valem os defaults do schema.
    }
  }
  return parseEnv(process.env);
}
