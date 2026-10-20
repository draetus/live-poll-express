import { type Logger, pino } from "pino";
import type { Env } from "../config/env.js";

export type { Logger };

export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: env.LOG_LEVEL,
    // Em dev, pino-pretty deixa o log legível para humanos.
    // Em produção, sai JSON puro (uma linha por evento), que o Render exibe e permite filtrar.
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            // "SYS:" = fuso horário da máquina (sem ele, o horário sai em UTC)
            options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
          }
        : undefined,
  });
}
